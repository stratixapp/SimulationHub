/* ===== Student Gate — session start/resume/switch ===== */
(function(){
  function knownStudents(){
    try{ return JSON.parse(window.localStorage.getItem('gstKnownStudents')||'[]'); }catch(e){ return []; }
  }
  function saveKnownStudent(id,label){
    const list=knownStudents().filter(s=>s.id!==id);
    list.unshift({id,label,lastActive:new Date().toISOString()});
    window.localStorage.setItem('gstKnownStudents',JSON.stringify(list.slice(0,60)));
  }
  function sanitizeId(name){
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,60)||('student_'+Date.now());
  }
  window.gstStartStudentSession=function(){
    const el=document.getElementById('studentGateInput');
    const name=(el?.value||'').trim();
    if(!name){ el?.focus(); if(el){el.style.borderColor='#c33';} return; }
    const id=sanitizeId(name);
    window.localStorage.setItem('gstActiveStudentId',id);
    saveKnownStudent(id,name);
    location.reload();
  };
  window.gstResumeStudent=function(id,label){
    window.localStorage.setItem('gstActiveStudentId',id);
    saveKnownStudent(id,label);
    location.reload();
  };
  // Deleting a name removes it from the known-students list AND wipes every
  // piece of that specific student's namespaced data (their registration
  // drafts, returns, ledgers — everything under stu__<id>__*) — a clean,
  // full erase, not just hiding the name from the list.
  window.gstDeleteStudent=function(id){
    if(!confirm('Delete this name and permanently erase all of that student\'s data on this computer? This cannot be undone.')) return;
    const list=knownStudents().filter(s=>s.id!==id);
    window.localStorage.setItem('gstKnownStudents',JSON.stringify(list));
    const prefix='stu__'+id+'__';
    const toRemove=[];
    for(let i=0;i<window.localStorage.length;i++){ const k=window.localStorage.key(i); if(k&&k.startsWith(prefix)) toRemove.push(k); }
    toRemove.forEach(k=>window.localStorage.removeItem(k));
    renderKnownList();
  };
  window.gstSwitchStudent=function(){
    if(!confirm('Switch to a different student? Your own progress is saved and will be here when you type your name again.')) return;
    window.localStorage.removeItem('gstActiveStudentId');
    location.reload();
  };
  function escHtml(s){ return String(s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }
  function renderKnownList(){
    const box=document.getElementById('studentGateKnown');
    const inputEl=document.getElementById('studentGateInput');
    if(!box) return;
    const q=(inputEl?.value||'').trim().toLowerCase();
    if(!q){ box.innerHTML=''; return; } // nothing shown until the student actually searches
    const list=knownStudents().filter(s=>s.label.toLowerCase().includes(q));
    if(!list.length){ box.innerHTML='<div class="student-gate-known-label">No matching saved names — press Start to begin a new session.</div>'; return; }
    // Built with data-* attributes + addEventListener rather than inline
    // onclick="...'${label}'..." — a label containing a quote character
    // (or JSON.stringify's own double quotes landing inside a
    // double-quoted onclick="") corrupted the HTML attribute and broke
    // the click handler entirely. data-* + JS listeners sidestep that.
    box.innerHTML='<div class="student-gate-known-label">Saved names on this computer</div><div class="student-gate-known-list">'+
      list.map(s=>`<div class="student-gate-row" data-student-id="${escHtml(s.id)}" data-student-label="${escHtml(s.label)}">
        <span class="student-gate-row-name">${escHtml(s.label)}</span>
        <button class="student-gate-row-del" data-student-id="${escHtml(s.id)}" title="Delete this name and erase their data">✕</button>
      </div>`).join('')+'</div>';
    box.querySelectorAll('.student-gate-row').forEach(row=>{
      row.addEventListener('click',()=>{
        window.gstResumeStudent(row.dataset.studentId,row.dataset.studentLabel);
      });
    });
    box.querySelectorAll('.student-gate-row-del').forEach(btn=>{
      btn.addEventListener('click',ev=>{
        ev.stopPropagation();
        window.gstDeleteStudent(btn.dataset.studentId);
      });
    });
  }
  function renderGate(){
    const gate=document.getElementById('studentGate');
    const activeId=window.localStorage.getItem('gstActiveStudentId');
    if(activeId){ if(gate) gate.style.display='none'; return; }
    if(gate) gate.style.display='flex';
    renderKnownList();
    const inputEl=document.getElementById('studentGateInput');
    if(inputEl){
      inputEl.addEventListener('input',renderKnownList);
      inputEl.addEventListener('keydown',e=>{if(e.key==='Enter')window.gstStartStudentSession();});
      setTimeout(()=>inputEl.focus(),50);
    }
  }
  document.addEventListener('DOMContentLoaded',renderGate);
})();

/* ===================================================================
   PER-STUDENT DATA NAMESPACING (multi-student, same computer)
   Everything the app reads/writes via localStorage/sessionStorage gets
   transparently prefixed with the currently active student's ID, so two
   students using the same browser never see or overwrite each other's
   registration/returns progress — each resumes exactly where they left
   off when they type their own name again. No other line in this file
   needs to change: this wraps the real Storage objects (both dot-
   notation access like localStorage.gstTRN and the normal getItem/
   setItem/removeItem/clear methods) completely transparently.
   Must run before anything else in this file touches storage.
   =================================================================== */
(function(){
  const RESERVED=new Set(['gstActiveStudentId','gstKnownStudents']);
  function wrap(real){
    function prefix(){
      const id=real.getItem('gstActiveStudentId')||'';
      return id?('stu__'+id+'__'):'';
    }
    function pk(key){ return RESERVED.has(key)?key:(prefix()+key); }
    return new Proxy(real,{
      get(target,prop){
        if(prop==='getItem') return key=>target.getItem(pk(key));
        if(prop==='setItem') return (key,val)=>target.setItem(pk(key),val);
        if(prop==='removeItem') return key=>target.removeItem(pk(key));
        if(prop==='clear') return ()=>{
          const p=prefix(); const toRemove=[];
          for(let i=0;i<target.length;i++){const k=target.key(i);if(!p||k.startsWith(p))toRemove.push(k);}
          toRemove.forEach(k=>target.removeItem(k));
        };
        if(prop==='key') return i=>target.key(i);
        if(prop==='length') return target.length;
        if(prop in target && typeof target[prop]==='function') return target[prop].bind(target);
        if(prop in target) return target[prop];
        if(typeof prop==='string') return target.getItem(pk(prop));
        return undefined;
      },
      set(target,prop,value){
        if(typeof prop==='string'){ target.setItem(pk(prop),String(value)); return true; }
        target[prop]=value; return true;
      },
      has(target,prop){ return (typeof prop==='string') ? target.getItem(pk(prop))!==null : (prop in target); }
    });
  }
  try{
    const realLS=window.localStorage, realSS=window.sessionStorage;
    Object.defineProperty(window,'localStorage',{value:wrap(realLS),configurable:true});
    Object.defineProperty(window,'sessionStorage',{value:wrap(realSS),configurable:true});
  }catch(e){ console.warn('Per-student storage namespacing unavailable in this browser; falling back to shared storage.',e); }
})();

const titles={registration:'New Registration',challan:'Create Challan',payment:'Track Payment Status',refund:'Refund — Track Application Status',
eway:'Generate E-Way Bill',hsn:'Search HSN Code',taxpayer:'Search Taxpayer',gstp:'Locate GST Practitioner',invoice:'e-Invoice Verification',
grievance:'Grievance Redressal',apps:'My Applications',ledger:'Electronic Cash Ledger'};
function megaTab(e,id){e.stopPropagation();let m=e.currentTarget.closest('.services-mega');m.querySelectorAll('.mega-tab').forEach(x=>x.classList.remove('active'));m.querySelectorAll('.mega-panel').forEach(x=>x.classList.remove('active'));e.currentTarget.classList.add('active');m.querySelector('#'+id).classList.add('active')}
function closeFeature(e){if(!e||e.target===document.getElementById('featureBg')){document.getElementById('featureBg').style.display='none';document.body.style.overflow=''}}
function prepareLoggedInChrome(){
  const host=document.getElementById('gstFeatureHeader');
  const header=host?.querySelector('.header');
  if(header){
    header.classList.add('logged-in-header');
    const auth=header.querySelector('.auth');
    if(auth){
      const rp=gstRead('gstTaxpayer',{}); auth.innerHTML=`<span class="portal-user">${esc(rp.legalName||'Registered Taxpayer')}</span><button onclick="closeFeature()">LOGOUT</button>`;
    }
  }
  const navHost=document.getElementById('gstFeatureNav');
  const nav=navHost?.querySelector('.nav-wrap .nav');
  if(!nav) return;
  nav.classList.add('logged-in-nav');
  const items=Array.from(nav.children).filter(x=>x.classList.contains('nav-item'));
  if(items[0]) items[0].textContent='Dashboard';
  const desired=['Dashboard','Services','GST Law','Downloads','Search Taxpayer','Help and Taxpayer Facilities','e-Invoice','News and Updates'];
  // Keep the original Services mega-menu, but make the logged-in shell use the current portal top-level labels.
  const services=items.find(x=>x.textContent.trim().startsWith('Services'));
  nav.innerHTML='';
  desired.forEach((label,i)=>{
    if(label==='Services' && services){ nav.appendChild(services); return; }
    const el=document.createElement('div'); el.className='nav-item'+(i===0?' active':''); el.textContent=label;
    if(label==='Dashboard') el.onclick=()=>{ try{ openReturnsDashboard(); }catch(e){ location.reload(); } };
    else if(label==='Search Taxpayer') el.onclick=()=>openFeature('taxpayer');
    else if(label==='e-Invoice') el.onclick=()=>openFeature('einvoice');
    else if(label==='Downloads') el.onclick=()=>openFeature('forms');
    else if(label==='Help and Taxpayer Facilities') el.onclick=()=>openFeature('grievance');
    else if(label==='News and Updates') el.onclick=()=>notify('News and Updates');
    else if(label==='GST Law') el.onclick=()=>openFeature('law');
    nav.appendChild(el);
  });
}

function feature(title,sub,body){
  /* High-fidelity GST Portal shell: reuse the original portal header/navigation
     instead of a generic SaaS sidebar. All feature pages continue to use the
     existing connected simulator state underneath this shell. */
  const host=document.getElementById('featureBody');
  host.innerHTML=`
    <div class="gst-real-portal-shell">
      <div id="gstFeatureTopStrip"></div>
      <div id="gstFeatureHeader"></div>
      <div id="gstFeatureNav"></div>
      <div class="gst-feature-context logged-in-context">
        <div class="gst-feature-breadcrumb"><span>Dashboard</span> &nbsp;›&nbsp; <span>${esc(sub||title)}</span></div>
        <div class="gst-feature-session"><span>Welcome <b>${esc((gstRead('gstTaxpayer',{}).legalName)||'Registered Taxpayer')}</b></span><span>GSTIN: <b>${esc((gstRead('gstTaxpayer',{}).gstin)||'')}</b></span><span>FY: <b>${esc((gstRead('gstTaxpayer',{}).fy)||'2026-27')}</b></span><span class="portal-language">English ▾</span><button class="gst-feature-close" onclick="closeFeature()">LOGOUT</button></div>
      </div>
      <main class="gst-real-workspace"><div class="gst-real-content">${body}</div></main>
      <footer class="gst-real-footer"><div>© 2026-27 Goods and Services Tax Network</div><div>Site Last Updated on 04-08-2026 &nbsp; • &nbsp; Designed & Developed by GSTN</div></footer>
    </div>`;

  /* Clone the exact public portal chrome already present in the uploaded file. */
  const strip=document.querySelector('.top-strip');
  const header=document.querySelector('.header');
  const nav=document.querySelector('.nav-wrap');
  if(strip) document.getElementById('gstFeatureTopStrip').appendChild(strip.cloneNode(true));
  if(header) document.getElementById('gstFeatureHeader').appendChild(header.cloneNode(true));
  if(nav){
    const n=nav.cloneNode(true);
    /* Avoid duplicate IDs while keeping mega-menu behavior inside the clone. */
    n.querySelectorAll('[id]').forEach(el=>{
      const old=el.id;
      el.id='feature_'+old;
      n.querySelectorAll('[onclick]').forEach(x=>{
        const a=x.getAttribute('onclick');
        if(a && a.includes("'"+old+"'")) x.setAttribute('onclick',a.replaceAll("'"+old+"'","'feature_"+old+"'"));
      });
    });
    document.getElementById('gstFeatureNav').appendChild(n);
  }
  prepareLoggedInChrome();
  document.getElementById('featureBg').style.display='flex';
  document.body.style.overflow='hidden';
}
// A large group of Registration/Ledgers/Payments/Compliance screens (Cash/Credit/
// Liability Ledger, Challan, Payment, Cancellation, Revocation, LUT, Communication,
// Grievance, GST Practitioner, Demand & Recovery, Appeal, Notices & Orders,
// Application Tracking, View e-Filed Returns, Amendment History, and more — 27
// call sites in total) were all written calling a renderer named nav(title,sub,body)
// that was never actually defined anywhere in the app. Every one of those screens
// threw "nav is not defined" and crashed the instant you opened it. Aliasing nav to
// the real renderer (feature) here fixes all of them at once, at the root cause,
// without having to touch each of the 27 call sites individually.
function nav(title,sub,body){return feature(title,sub,body);}

function legacyFeatureNav(label){
  notify(label+' selected');
}

function openFeature(t){
 // Services > Registration > New Registration uses the same complete
 // User Credentials -> OTP Verification flow as the dedicated registration page.
 if(t==='new-registration')return openServiceNewRegistration();
 if(t==='challan')return challan();
 if(t==='payment-status')return paymentStatus();
 if(t==='refund-status'||t.startsWith('track-'))return track(t);
 if(t.startsWith('eway-'))return eway(t);
 if(t==='hsn')return hsn();
 if(t.startsWith('taxpayer'))return taxpayer(t);
 if(t==='gstp')return gstp();
 if(t==='refund-apply')return refundApply();
 if(t==='cash-ledger')return ledger();
 if(t==='applications')return applications();
 if(t==='einvoice'||t==='verify-invoice'||t==='irn')return invoice();
 if(t==='grievance'||t==='payment-grievance')return grievance();
 generic(t.replaceAll('-',' '));
}
function openServiceNewRegistration(){
  registrationPage();
  const servicePanel=document.querySelector('.services-mega');
  if(servicePanel) servicePanel.style.display='';
}

function registrationPage(){
  document.body.classList.add('registration-mode');
  const main=document.querySelector('.main');
  main.innerHTML=`
    <div class="content">
      <div class="reg-breadcrumb"><span>Home</span> › <span>Registration</span></div>
      <div class="reg-page">
        <div class="reg-steps"><div class="reg-step one">User Credentials</div><div class="reg-step two">OTP Verification</div></div>
        <div class="reg-title-row"><div class="reg-title">New Registration</div><div class="reg-mand"><b>*</b> indicates mandatory fields</div></div>
        <div class="reg-choice">
          <label><input type="radio" name="regMode" value="new" checked onchange="toggleRegMode()"> New Registration</label>
          <label><input type="radio" name="regMode" value="trn" onchange="toggleRegMode()"> Temporary Reference Number (TRN)</label>
        </div>
        <form class="reg-form" onsubmit="event.preventDefault();submitRegistrationPage()">
          <div id="newRegFields">
            <label class="field">I am a <b>*</b></label>
            <select id="rp_type"><option value="">Select</option><option>Taxpayer</option><option>Tax Deductor</option><option>Tax Collector</option><option>GST Practitioner</option></select>
            <label class="field">State / UT <b>*</b></label>
            <select id="rp_state"><option value="">Select</option><option>Andaman and Nicobar Islands</option><option>Andhra Pradesh</option><option>Arunachal Pradesh</option><option>Assam</option><option>Bihar</option><option>Chandigarh</option><option>Chhattisgarh</option><option>Dadra and Nagar Haveli and Daman and Diu</option><option>Delhi</option><option>Goa</option><option>Gujarat</option><option>Haryana</option><option>Himachal Pradesh</option><option>Jammu and Kashmir</option><option>Jharkhand</option><option>Karnataka</option><option>Kerala</option><option>Ladakh</option><option>Lakshadweep</option><option>Madhya Pradesh</option><option>Maharashtra</option><option>Manipur</option><option>Meghalaya</option><option>Mizoram</option><option>Nagaland</option><option>Odisha</option><option>Puducherry</option><option>Punjab</option><option>Rajasthan</option><option>Sikkim</option><option>Tamil Nadu</option><option>Telangana</option><option>Tripura</option><option>Uttar Pradesh</option><option>Uttarakhand</option><option>West Bengal</option></select>
            <label class="field">District</label>
            <select id="rp_district"><option value="">Select State first</option></select>
            <label class="field">Legal Name of the Business (As mentioned in PAN) <b>*</b></label>
            <input id="rp_name" placeholder="Enter Legal Name of Business">
            <label class="field">Permanent Account Number (PAN) <b>*</b></label>
            <input id="rp_pan" maxlength="10" placeholder="Enter Permanent Account Number (PAN)" style="text-transform:uppercase">
            <div class="hint">If you don't have PAN, Click <a href="#" onclick="event.preventDefault();notify('PAN application link opened')" style="color:#1262a0">here</a> to apply</div>
            <label class="field">Email Address <b>*</b></label>
            <input id="rp_email" type="email" placeholder="Enter Email Address">
            <div class="hint">◉ OTP will be sent to this Email Address</div>
            <label class="field">Mobile Number <b>*</b></label>
            <div class="mobile-wrap"><input class="mobile-code" value="+91" readonly><input class="mobile-input" id="rp_mobile" maxlength="10" placeholder="Enter Mobile Number"></div>
            <div class="hint">◉ Separate OTP will be sent to this mobile number</div>
            <label class="field">Type the characters you see in the image below <b>*</b></label>
            <div class="reg-captcha"><div class="reg-captcha-box" id="regCaptchaText">8R5D9</div><span class="reg-refresh" onclick="refreshRegCaptcha()">↻ Refresh</span></div>
            <input id="rp_captcha" placeholder="Enter captcha text">
          </div>
          <div id="trnFields" style="display:none">
            <label class="field">Temporary Reference Number (TRN) <b>*</b></label>
            <input id="rp_trn" placeholder="Enter Temporary Reference Number (TRN)">
            <label class="field">Type the characters you see in the image below <b>*</b></label>
            <div class="reg-captcha"><div class="reg-captcha-box" id="trnCaptchaText">7K3P2</div><span class="reg-refresh" onclick="refreshTRNCaptcha()">↻ Refresh</span></div>
            <input id="rp_trn_captcha" placeholder="Enter captcha text">
          </div>
          <button class="reg-proceed" type="submit">PROCEED</button>
          <div id="regMessage" class="reg-message"></div>
        </form>
      </div>
    </div>`;
  window.scrollTo(0,0);
  bindPANInputs();
  bindRegStateDistrict();
}
function bindRegStateDistrict(){
  // Real bug fixed: the District dropdown used to be a hardcoded Kerala
  // list regardless of which State was picked. Now it's rebuilt from
  // DISTRICTS_BY_STATE every time State changes, so it always matches.
  const stateEl=document.getElementById('rp_state'), distEl=document.getElementById('rp_district');
  if(!stateEl||!distEl) return;
  function refresh(){
    const st=stateEl.value;
    const list=DISTRICTS_BY_STATE[st];
    distEl.innerHTML = list
      ? '<option value="">Select</option>'+list.map(d=>`<option>${d}</option>`).join('')
      : '<option value="">Select State first</option>';
  }
  stateEl.addEventListener('change',refresh);
  refresh();
}
function toggleRegMode(){
  const trn=document.querySelector('input[name="regMode"]:checked')?.value==='trn';
  document.getElementById('newRegFields').style.display=trn?'none':'block';
  document.getElementById('trnFields').style.display=trn?'block':'none';
}
function refreshRegCaptcha(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<5;i++)s+=chars[Math.floor(Math.random()*chars.length)];
  const el=document.getElementById('regCaptchaText');if(el)el.textContent=s;
}
function refreshTRNCaptcha(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<5;i++)s+=chars[Math.floor(Math.random()*chars.length)];
  const el=document.getElementById('trnCaptchaText');if(el)el.textContent=s;
}

function normalizePAN(value){
  return String(value||'').replace(/\s+/g,'').toUpperCase();
}
function isValidPANFormat(value){
  // Training simulator: accept any 10-character alphanumeric PAN-like value.
  // No live CBDT/PAN lookup is performed, so never report a PAN as fake/not found.
  const v=normalizePAN(value);
  return /^[A-Z0-9]{10}$/.test(v);
}
/*
 * Training-only PAN behavior:
 * GST registration normally validates the Legal Name + PAN against CBDT.
 * This offline simulator cannot perform that live lookup, so it must NOT
 * invent a "PAN is fake/not found" result. It only checks the PAN structure
 * and then proceeds to the simulated PAN-mapping screen.
 */
function bindPANInputs(){
  document.querySelectorAll('input[id="rp_pan"], input[name*="pan" i]').forEach(el=>{
    el.addEventListener('input',()=>{ el.value=normalizePAN(el.value); });
    el.addEventListener('blur',()=>{ el.value=normalizePAN(el.value); });
  });
}

function submitRegistrationPage(){
  const isTRN=document.querySelector('input[name="regMode"]:checked')?.value==='trn';
  const box=document.getElementById('regMessage');
  if(box){box.className='reg-message';box.style.display='none';}

  if(isTRN){
    const trn=(document.getElementById('rp_trn')?.value||'').trim();
    const captcha=(document.getElementById('rp_trn_captcha')?.value||'').trim().toUpperCase();
    const expectedTRNCaptcha=(document.getElementById('trnCaptchaText')?.textContent||'').trim().toUpperCase();
    if(!/^\d{15}$/.test(trn)){
      if(box){box.style.display='block';box.className='reg-message error';box.textContent='Enter a valid 15-digit Temporary Reference Number (TRN).';}
      return;
    }
    if(!captcha || captcha!==expectedTRNCaptcha){
      if(box){box.style.display='block';box.className='reg-message error';box.textContent='Enter the captcha correctly.';}
      return;
    }
    // Universal TRN — a fixed, realistic-looking 15-digit TRN that always
    // works to jump straight into (or resume) a Part-B application, without
    // needing to have generated one in this exact browser session first.
    // Regular TRNs generated via New Registration continue to work exactly
    // as before (matched against the saved application, as-is).
    const UNIVERSAL_TRN='270000000000001';
    if(trn===UNIVERSAL_TRN){
      let saved2=JSON.parse(localStorage.getItem('gstRegistrationApplication')||'{}');
      if(!saved2.trn || saved2.trn!==UNIVERSAL_TRN){
        const generatedAt=new Date(); const expiry=new Date(generatedAt.getTime()+15*24*60*60*1000);
        const partA=JSON.parse(localStorage.getItem('gstPartA')||'{}');
        saved2={trn:UNIVERSAL_TRN,partA,status:'Draft',createdAt:generatedAt.toISOString(),expiryAt:expiry.toISOString(),steps:{partA:true,otp:true,trn:true,partB:false,verification:false,submission:false}};
        localStorage.setItem('gstRegistrationApplication',JSON.stringify(saved2));
        localStorage.setItem('gstTRN',UNIVERSAL_TRN);
        localStorage.setItem('gstTRNGeneratedAt',generatedAt.toISOString());
        localStorage.setItem('gstTRNExpiry',expiry.toISOString());
      }
      localStorage.setItem('gstTRNLoginAttempt',UNIVERSAL_TRN);
      localStorage.setItem('gstTRNLoginStartedAt',new Date().toISOString());
      openOtpVerification('trn-login');
      return;
    }
    const saved=JSON.parse(localStorage.getItem('gstRegistrationApplication')||'{}');
    if(saved.trn && saved.trn!==trn){
      if(box){box.style.display='block';box.className='reg-message error';box.textContent='This TRN is not found in the current simulator session. Generate a TRN first or use the TRN saved in this browser.';}
      return;
    }
    if(!saved.trn){
      if(box){box.style.display='block';box.className='reg-message error';box.textContent='No saved registration application was found for this TRN.';}
      return;
    }
    localStorage.setItem('gstTRNLoginAttempt',trn);
    localStorage.setItem('gstTRNLoginStartedAt',new Date().toISOString());
    openOtpVerification('trn-login');
    return;
  }

  const partA={
    taxpayerType:document.getElementById('rp_type')?.value||'',
    state:document.getElementById('rp_state')?.value||'',
    district:document.getElementById('rp_district')?.value||'',
    legalName:document.getElementById('rp_name')?.value.trim()||'',
    pan:normalizePAN(document.getElementById('rp_pan')?.value||''),
    email:document.getElementById('rp_email')?.value.trim()||'',
    mobile:document.getElementById('rp_mobile')?.value.trim()||'',
    captcha:(document.getElementById('rp_captcha')?.value||'').trim().toUpperCase()
  };
  const expectedCaptcha=(document.getElementById('regCaptchaText')?.textContent||'').trim().toUpperCase();
  const errors=[];
  if(!partA.taxpayerType) errors.push('Select the taxpayer type.');
  if(!partA.state) errors.push('Select the State/UT.');
  if(!partA.legalName) errors.push('Enter the legal name as mentioned in PAN.');
  if(!isValidPANFormat(partA.pan)) errors.push('Enter a 10-character PAN. PAN matching is simulated locally.');
  if(!/^\S+@\S+\.\S+$/.test(partA.email)) errors.push('Enter a valid email address.');
  if(!/^\d{10}$/.test(partA.mobile)) errors.push('Enter a valid 10-digit mobile number.');
  if(!partA.captcha || (expectedCaptcha && partA.captcha!==expectedCaptcha)) errors.push('Enter the captcha correctly.');
  if(errors.length){
    if(box){box.style.display='block';box.className='reg-message error';box.innerHTML=errors.map(e=>'• '+esc(e)).join('<br>');}
    return;
  }
  localStorage.setItem('gstPartA',JSON.stringify(partA));
  showPANMappedRegistrations(partA);
}

function showPANMappedRegistrations(partA){
  const main=document.querySelector('.main'); if(!main)return;
  const existing=JSON.parse(localStorage.getItem('gstMappedRegistrations')||'[]');
  main.innerHTML=`
    <div class="content">
      <div class="reg-breadcrumb"><span>Home</span> › <span>Registration</span> › <span>PAN Validation</span></div>
      <div class="reg-page">
        <div class="reg-steps"><div class="reg-step one done">User Credentials</div><div class="reg-step two current">PAN Validation</div><div class="reg-step three">OTP Verification</div><div class="reg-step four">TRN Generated</div></div>
        <div class="reg-title-row"><div class="reg-title">Existing Registrations Mapped to PAN</div><div class="reg-mand">GST Portal validation step</div></div>
        <div class="gst-alert info" style="margin-bottom:14px">The GST Portal displays registrations/provisional IDs/UINs/GSTP IDs mapped to the PAN before OTP verification.</div>
        <table class="gst-table" style="width:100%;margin-bottom:18px"><tr><th>Legal Name</th><td>${esc(partA.legalName)}</td><th>PAN</th><td>${esc(partA.pan)}</td></tr><tr><th>State / UT</th><td>${esc(partA.state)}</td><th>Taxpayer Type</th><td>${esc(partA.taxpayerType)}</td></tr></table>
        <div class="gst-section-title">Existing registrations / provisional IDs / UINs / GSTP IDs</div>
        <table class="gst-table" style="width:100%">
          <tr><th>Registration / ID</th><th>State</th><th>Status</th><th>Action</th></tr>
          ${existing.length?existing.map(x=>`<tr><td>${esc(x.id)}</td><td>${esc(x.state)}</td><td>${esc(x.status)}</td><td>View</td></tr>`).join(''):`<tr><td colspan="4" style="text-align:center;color:#666">No existing registrations found for this demo PAN.</td></tr>`}
        </table>
        <div class="partb-footer" style="margin-top:18px"><button class="reg-back-btn" onclick="registrationPage()">BACK</button><button class="reg-proceed" onclick="openOtpVerification('part-a')">PROCEED</button></div>
        <div class="demo-note trn-demo-note">Training simulator: PAN/registration matching is simulated locally. No CBDT/GSTN database is contacted.</div>
      </div>
    </div>`;
  window.scrollTo(0,0);
}

let demoMobileOtp='', demoEmailOtp='', otpFlow='part-a';
function openOtpVerification(flow='part-a'){
  otpFlow=flow;
  const overlay=document.getElementById('otpOverlay');
  const status=document.getElementById('otpStatus');
  if(!overlay||!status)return;
  demoMobileOtp=String(Math.floor(100000+Math.random()*900000));
  demoEmailOtp=flow==='trn-login'?demoMobileOtp:String(Math.floor(100000+Math.random()*900000));
  const mobile=document.getElementById('mobileOtp'), email=document.getElementById('emailOtp');
  if(mobile)mobile.value='';
  if(email)email.value='';
  status.innerHTML=flow==='trn-login'
    ? 'Training TRN-login OTP generated locally. <b>Use the same OTP in both Mobile OTP and Email OTP: '+demoMobileOtp+'</b><br><small>In the documented TRN login flow, the mobile and email fields use the same OTP.</small>'
    : 'Demo OTPs generated locally. <b>Mobile: '+demoMobileOtp+'</b> &nbsp; <b>Email: '+demoEmailOtp+'</b>';
  status.style.display='block';
  overlay.classList.add('open'); overlay.style.display='flex'; document.body.style.overflow='hidden';
  document.querySelectorAll('.reg-step').forEach(s=>s.classList.remove('current'));
  const step2=document.querySelector('.reg-step.two'); if(step2)step2.classList.add('current');
  setTimeout(()=>document.getElementById('mobileOtp')?.focus(),50);
}
function closeOtpOverlay(e){if(!e||e.target===document.getElementById('otpOverlay')){const overlay=document.getElementById('otpOverlay');overlay.classList.remove('open');overlay.style.display='none';document.body.style.overflow='';}}
function resendOtp(type){
  if(type==='mobile')demoMobileOtp=String(Math.floor(100000+Math.random()*900000));
  else demoEmailOtp=otpFlow==='trn-login'?demoMobileOtp:String(Math.floor(100000+Math.random()*900000));
  if(otpFlow==='trn-login')demoEmailOtp=demoMobileOtp;
  const status=document.getElementById('otpStatus');
  status.innerHTML=otpFlow==='trn-login'?('Training TRN-login OTP resent. <b>Use the same OTP in both Mobile OTP and Email OTP: '+demoMobileOtp+'</b><br><small>In the documented TRN login flow, the mobile and email fields use the same OTP.</small>'):('Demo OTP resent. <b>Mobile OTP: '+demoMobileOtp+'</b> &nbsp; <b>Email OTP: '+demoEmailOtp+'</b>');
  status.style.display='block';
}
function verifyOtpDemo(){
  const m=document.getElementById('mobileOtp')?.value.trim()||'';
  const em=document.getElementById('emailOtp')?.value.trim()||'';
  const status=document.getElementById('otpStatus');
  if(!/^\d{6}$/.test(m)||!/^\d{6}$/.test(em)){status.textContent='Please enter the required 6-digit OTP(s).';status.style.display='block';return;}
  const valid=otpFlow==='trn-login'?(m===demoMobileOtp&&em===demoMobileOtp):(m===demoMobileOtp&&em===demoEmailOtp);
  if(!valid){status.textContent='Invalid OTP. Please enter the simulated OTP(s) shown above or resend.';status.style.display='block';return;}
  if(otpFlow==='trn-login'){
    closeOtpOverlay();
    showSavedRegistrationApplication(localStorage.getItem('gstTRNLoginAttempt')||localStorage.getItem('gstTRN')||'');
    return;
  }
  const trn=generateTRN();
  const generatedAt=new Date();
  const expiry=new Date(generatedAt.getTime()+15*24*60*60*1000);
  localStorage.setItem('gstTRN',trn);
  localStorage.setItem('gstTRNGeneratedAt',generatedAt.toISOString());
  localStorage.setItem('gstTRNExpiry',expiry.toISOString());
  const partA=JSON.parse(localStorage.getItem('gstPartA')||'{}');
  localStorage.setItem('gstRegistrationApplication',JSON.stringify({trn,partA,status:'Draft',createdAt:generatedAt.toISOString(),expiryAt:expiry.toISOString(),steps:{partA:true,otp:true,trn:true,partB:false,verification:false,submission:false}}));
  closeOtpOverlay(); showTRNGenerated(trn);
}
function generateTRN(){let n='';for(let i=0;i<15;i++)n+=Math.floor(Math.random()*10);if(n[0]==='0')n='1'+n.slice(1);return n;}

function showTRNGenerated(trn){
  const main=document.querySelector('.main'); if(!main)return;
  const expiry=localStorage.getItem('gstTRNExpiry');
  const expiryText=expiry?new Date(expiry).toLocaleString('en-IN'):'15 days from generation';
  main.innerHTML=`
    <div class="content"><div class="reg-breadcrumb"><span>Home</span> › <span>Registration</span> › <span>TRN Generated</span></div>
      <div class="reg-page trn-result-page"><div class="reg-steps"><div class="reg-step one done">User Credentials</div><div class="reg-step two done">OTP Verification</div><div class="reg-step three current">TRN Generated</div><div class="reg-step four">TRN Login</div><div class="reg-step five">My Saved Application</div></div>
        <div class="reg-title-row"><div class="reg-title">Temporary Reference Number (TRN)</div></div>
        <div class="trn-success-box"><div class="trn-check">✓</div><h2>TRN Generated Successfully</h2><p>Your mobile number and email address have been verified successfully.</p><div class="trn-label">Temporary Reference Number</div><div class="trn-number" id="generatedTRN">${esc(trn)}</div><div class="trn-valid">TRN expiry: <b>${esc(expiryText)}</b><br>TRN validity in the GST Portal workflow is 15 days. Keep this TRN safe to continue the application.<br><span style="display:inline-block;margin-top:8px">A TRN acknowledgement is sent to the registered mobile number and email address.</span></div></div>
        <div class="trn-next-box"><h3>Continue</h3><p>The real portal next requires you to return to <b>Services › Registration › New Registration</b>, choose <b>Temporary Reference Number (TRN)</b>, enter the TRN and captcha, and then verify OTP again before opening the saved application.</p><button class="reg-proceed" type="button" onclick="registrationPage();setTimeout(()=>{const r=document.querySelector('input[name=regMode][value=trn]');if(r){r.checked=true;toggleRegMode();}},0)">LOGIN WITH TRN</button><button class="reg-back-btn" type="button" onclick="registrationPage()">BACK TO REGISTRATION</button></div>
        <div class="demo-note trn-demo-note">Training simulator: this is a structurally correct 15-digit TRN-format value generated locally. It is not an actual GSTN-issued TRN.</div>
      </div></div>`;
  window.scrollTo(0,0);
}

function showSavedRegistrationApplication(trn){
  const main=document.querySelector('.main'); if(!main)return;
  const app=JSON.parse(localStorage.getItem('gstRegistrationApplication')||'{}');
  const partA=app.partA||JSON.parse(localStorage.getItem('gstPartA')||'{}');
  const expiry=app.expiryAt?new Date(app.expiryAt):null;
  if(!app.trn||app.trn!==trn){main.innerHTML='<div class="content"><div class="reg-page"><div class="gst-alert error">No saved application was found for this TRN.</div><button class="reg-proceed" onclick="registrationPage()">BACK</button></div></div>';return;}
  if(expiry&&Date.now()>expiry.getTime()){
    main.innerHTML='<div class="content"><div class="reg-page"><div class="gst-alert error"><b>TRN expired.</b><br>The saved application is no longer available after the 15-day TRN validity period.</div><button class="reg-proceed" onclick="registrationPage()">BACK TO NEW REGISTRATION</button></div></div>';return;
  }
  main.innerHTML=`<div class="content"><div class="reg-breadcrumb"><span>Home</span> › <span>Registration</span> › <span>My Saved Application</span></div><div class="reg-page"><div class="reg-title-row"><div class="reg-title">My Saved Application</div><div class="reg-mand">TRN: <b>${esc(trn)}</b></div></div><div class="gst-alert info"><b>Registration application saved successfully.</b><br>Status: <b>Draft</b>. The application can be edited until the TRN validity expires. Click the Edit icon to continue Part-B sequentially.</div><table class="gst-table" style="width:100%"><tr><th>TRN</th><td>${esc(trn)}</td><th>Status</th><td><span class="gst-status orange">Draft</span></td></tr><tr><th>Legal Name</th><td>${esc(partA.legalName)}</td><th>State / UT</th><td>${esc(partA.state)}</td></tr><tr><th>Created</th><td>${esc(app.createdAt?new Date(app.createdAt).toLocaleString('en-IN'):'')}</td><th>TRN Expiry</th><td>${esc(expiry?expiry.toLocaleString('en-IN'):'')}</td></tr></table><div style="text-align:center;margin-top:18px"><button class="reg-proceed" title="Edit saved application" onclick="openTRNPartB()">✎ EDIT</button></div><div class="demo-note trn-demo-note">This screen mirrors the saved-application checkpoint after TRN login. Real GSTN data is not accessed.</div></div></div>`;
  window.scrollTo(0,0);
}

function ensureSimulator100Zoom(){
  document.documentElement.style.zoom='100%';
  document.body.style.zoom='100%';
}

function pbIcon(name){
  const icons={
    briefcase:'<rect x="3" y="7" width="18" height="12" rx="1.5"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
    person:'<circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>',
    personCheck:'<circle cx="10" cy="8" r="3.4"/><path d="M3 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/><path d="M16.5 8.5l1.5 1.5 3-3"/>',
    people:'<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.6"/><path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M13.5 14.2c2.6.3 4.5 2.6 4.5 5.3"/>',
    pin:'<path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/>',
    pinAlt:'<path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z"/><path d="M9.5 9.5l2 2 3.5-4"/>',
    box:'<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
    building:'<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2"/>',
    lock:'<rect x="4" y="10" width="16" height="10" rx="1.5"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/>',
    check:'<circle cx="12" cy="12" r="9"/><path d="M7.5 12.5l3 3 6-6.5"/>'
  };
  return `<svg viewBox="0 0 24 24">${icons[name]||icons.check}</svg>`;
}
function regProfilePercent(){
  const d=window.gstPartBData||JSON.parse(localStorage.getItem('gstPartBData')||'{}');
  const checks=[
    !!(d.tradeName&&d.constitution&&d.rule14a),
    !!(d.promotersList&&d.promotersList.length),
    !!(d.signatoryList&&d.signatoryList.length),
    true, // Authorized Representative is optional (Yes/No toggle), always "answered"
    !!(d.prinBuilding&&d.prinPincode&&d.prinCommissionerate),
    true, // Additional Places optional unless toggled on
    !!((d.goodsList&&d.goodsList.length)||(d.servicesList&&d.servicesList.length)),
    true, // State Specific Information fields are all optional
    d.aadhaarOptIn!==undefined,
    !!(d.declaration&&d.verificationPlace)
  ];
  const done=checks.filter(Boolean).length;
  return Math.round((done/checks.length)*100);
}
function openTRNPartB(){
  document.body.classList.add('registration-mode');
  const trn=localStorage.getItem('gstTRN')||'';
  const app=JSON.parse(localStorage.getItem('gstRegistrationApplication')||'{}');
  const partA=app.partA||JSON.parse(localStorage.getItem('gstPartA')||'{}');
  const main=document.querySelector('.main'); if(!main)return;
  if(!trn||!app.trn||app.trn!==trn){registrationPage();return;}
  const today=new Date(), due=new Date(app.trnCreatedAt?new Date(app.trnCreatedAt).getTime()+15*86400000:today.getTime()+15*86400000);
  const fmt=dt=>String(dt.getDate()).padStart(2,'0')+'/'+String(dt.getMonth()+1).padStart(2,'0')+'/'+dt.getFullYear();
  main.innerHTML=`
    <div class="content registration-application"><div class="reg-breadcrumb"><span>Home</span> › <span>Registration</span> › <span>My Saved Application</span> › <span>Edit</span></div>
      <div class="application-shell"><div class="application-head"><div><div class="application-title">Application for Registration</div><div class="application-sub">FORM GST REG-01 • Part-B</div></div><div class="trn-chip">TRN: <b>${esc(trn)}</b><br><small>Draft application</small></div></div>
      <div class="reg-appbar"><div><span class="reg-appbar-label">Application Type</span><b>New Registration</b></div><div><span class="reg-appbar-label">Due Date to Complete</span><b>${fmt(due)}</b></div><div><span class="reg-appbar-label">Last Modified</span><b id="regLastModified">${fmt(today)}</b></div><div><span class="reg-appbar-label">Profile</span><b id="regProfilePct">${regProfilePercent()}%</b></div></div>
      <div class="partb-tabs" id="partBTabs"><button class="active" data-tab="business" onclick="partBTab('business')"><span class="pb-tab-ic">${pbIcon('briefcase')}</span>Business Details</button><button data-tab="promoters" onclick="partBTab('promoters')"><span class="pb-tab-ic">${pbIcon('person')}</span>Promoter Partners</button><button data-tab="signatory" onclick="partBTab('signatory')"><span class="pb-tab-ic">${pbIcon('personCheck')}</span>Authorized Signatory</button><button data-tab="representative" onclick="partBTab('representative')"><span class="pb-tab-ic">${pbIcon('people')}</span>Authorized Representative</button><button data-tab="principal" onclick="partBTab('principal')"><span class="pb-tab-ic">${pbIcon('pin')}</span>Principal Place of Business</button><button data-tab="additional" onclick="partBTab('additional')"><span class="pb-tab-ic">${pbIcon('pinAlt')}</span>Additional Places of Business</button><button data-tab="goods" onclick="partBTab('goods')"><span class="pb-tab-ic">${pbIcon('box')}</span>Goods And Services</button><button data-tab="state" onclick="partBTab('state')"><span class="pb-tab-ic">${pbIcon('building')}</span>State Specific Information</button><button data-tab="aadhaar" onclick="partBTab('aadhaar')"><span class="pb-tab-ic">${pbIcon('lock')}</span>Aadhaar Authentication</button><button data-tab="verification" onclick="partBTab('verification')"><span class="pb-tab-ic">${pbIcon('check')}</span>Verification</button></div>

      <div class="reg-mand-note"><span class="reg-mand-dot">&#9679;</span> indicates mandatory fields</div>
      <div id="partBPanel" class="partb-panel"></div><div class="partb-footer"><button class="reg-back-btn" onclick="partBBack()">BACK</button><div id="partBFooterActions"><button class="partb-save" onclick="savePartB()">SAVE DRAFT</button><button class="reg-proceed partb-next" onclick="partBNext()">SAVE &amp; CONTINUE</button></div></div><div id="partBGlobalMessage" class="reg-message"></div><div class="demo-note trn-demo-note">Simulator note: this reproduces the GST REG-01 Part-B workflow and validations locally. GSTN/PAN/Aadhaar/bank services are not called from this offline HTML.</div></div></div>`;
  ensureSimulator100Zoom(); window.scrollTo(0,0); window.gstPartBTab='business'; window.gstPartBData=JSON.parse(localStorage.getItem('gstPartBData')||'{}'); bindPANInputs(); partBTab('business');
}

function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function val(id){return document.getElementById(id)?.value?.trim()||'';}
function setVal(id,v){const e=document.getElementById(id);if(e)e.value=v||'';}
function radio(name,value){const e=document.querySelector(`input[name="${name}"][value="${CSS.escape(value||'')}"]`);if(e)e.checked=true;}
function partBData(){
  const d={...window.gstPartBData};
  document.querySelectorAll('#partBPanel input,#partBPanel select,#partBPanel textarea').forEach(e=>{
    if(!e.name) return;
    if(e.type==='radio'){
      // Bug fix: previously every radio in a group overwrote the value in DOM order,
      // so the LAST radio (checked or not) always won. Only the checked one should count.
      if(e.checked) d[e.name]=e.value;
      return;
    }
    if(e.type==='checkbox' && e.dataset.toggle){
      // Toggle switches (Yes/No pill switches) store 'Yes' / 'No' so the rest of the
      // Part-B logic can keep comparing against string values consistently.
      d[e.name]=e.checked?'Yes':'No';
      return;
    }
    let v=e.type==='checkbox'?e.checked:e.value;
    if(/pan/i.test(e.name) && typeof v==='string') v=normalizePAN(v);
    d[e.name]=v;
  });
  window.gstPartBData=d; localStorage.setItem('gstPartBData',JSON.stringify(d)); return d;
}
function input(name,label,placeholder='',extra=''){const d=window.gstPartBData||{};const req=/required/.test(extra);return `<label class="field">${label}${req?' <b>*</b>':''}</label><input name="${name}" value="${esc(d[name]||'')}" placeholder="${placeholder}" ${extra}>`;}
function select(name,label,opts,required=false){const d=window.gstPartBData||{};return `<label class="field">${label}${required?' <b>*</b>':''}</label><select name="${name}" ${required?'required':''}><option value="">Select</option>${opts.map(o=>`<option ${d[name]===o?'selected':''}>${o}</option>`).join('')}</select>`;}
function yesNo(name,label,note){const d=window.gstPartBData||{};return `<label class="field">${label}${note?` <span class="info-i" title="${esc(note)}">&#9432;</span>`:''}</label><div class="yesno"><label><input type="radio" name="${name}" value="Yes" ${d[name]==='Yes'?'checked':''}> Yes</label><label><input type="radio" name="${name}" value="No" ${d[name]==='No'||!d[name]?'checked':''}> No</label></div>`;}
function toggle(name,label,sub){const d=window.gstPartBData||{};const on=d[name]==='Yes';return `<div class="full toggle-row"><div class="toggle-label">${label}${sub?`<div class="toggle-sub">${sub}</div>`:''}</div><label class="switch"><input type="checkbox" name="${name}" data-toggle="1" value="Yes" ${on?'checked':''}><span class="slider"></span></label></div>`;}
function section(title,body,note=''){return `<section class="pb-section"><h3>${title}</h3>${note?`<div class="pb-note">${note}</div>`:''}<div class="pb-grid">${body}</div></section>`;}
function miniMap(prefix){
  prefix=prefix||'addr';
  return `<div class="full"><div class="map-search-row"><input id="${prefix}_mapSearch" class="f-input" placeholder="Search for area, street name, landmark or pin code"><button type="button" class="small-btn" onclick="mapSearch('${prefix}')">SEARCH</button></div>
    <div id="${prefix}_mapSuggest" class="map-suggest"></div>
    <div class="mini-map" id="${prefix}_mapCanvas" data-map-prefix="${prefix}"></div>
    <div class="gst-action-row" style="margin-top:6px"><button type="button" class="small-btn" onclick="mapConfirm('${prefix}')">CONFIRM LOCATION</button></div>
    </div>`;
}
/* ---------------------------------------------------------------------
   Real Leaflet + OpenStreetMap integration (replaces the earlier fully-
   offline CSS-gradient placeholder). Matches the live GST portal's
   address-map screens: default India-centered view, click-to-drop-pin,
   Leaflet's own zoom control + "Leaflet | © OpenStreetMap contributors"
   attribution. Requires internet access in the browser to fetch tiles —
   everything else in the simulator remains local/offline.
   --------------------------------------------------------------------- */
window._gstLeafletMaps=window._gstLeafletMaps||{};
function initAllMiniMaps(){
  if(typeof L==='undefined')return; // Leaflet failed to load (offline) — canvas stays blank, form still usable
  document.querySelectorAll('.mini-map[data-map-prefix]').forEach(el=>initMiniMap(el.dataset.mapPrefix));
}
function initMiniMap(prefix){
  if(typeof L==='undefined')return;
  const old=window._gstLeafletMaps[prefix];
  if(old){try{old.remove()}catch(e){}delete window._gstLeafletMaps[prefix];}
  const el=document.getElementById(prefix+'_mapCanvas'); if(!el)return;
  const d=window.gstPartBData||{};
  const savedLat=parseFloat(d[prefix+'Lat']), savedLng=parseFloat(d[prefix+'Lng']);
  const hasSaved=!isNaN(savedLat)&&!isNaN(savedLng);
  const start=hasSaved?[savedLat,savedLng]:[22.9734,78.6569]; // India centroid, matches reference default view
  const map=L.map(el,{scrollWheelZoom:false}).setView(start,hasSaved?12:4.6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
  let marker=hasSaved?L.marker(start).addTo(map):null;
  map.on('click',e=>{
    if(marker){marker.setLatLng(e.latlng)}else{marker=L.marker(e.latlng).addTo(map)}
    setMapLatLng(prefix,e.latlng.lat,e.latlng.lng);
    notify('Pin dropped. Fill in the exact address details below, then Confirm Location.');
  });
  window._gstLeafletMaps[prefix]=map;
  setTimeout(()=>{try{map.invalidateSize()}catch(e){}},60);
}
function setMapLatLng(prefix,lat,lng){
  partBData();
  const d=window.gstPartBData;
  d[prefix+'_pinLat']=lat; d[prefix+'_pinLng']=lng;
  const latEl=document.querySelector(`[name="${prefix}Lat"]`); if(latEl)latEl.value=lat.toFixed(6);
  const lngEl=document.querySelector(`[name="${prefix}Lng"]`); if(lngEl)lngEl.value=lng.toFixed(6);
  d[prefix+'Lat']=lat.toFixed(6); d[prefix+'Lng']=lng.toFixed(6);
  localStorage.setItem('gstPartBData',JSON.stringify(d));
}
const GST_MAP_PLACES=[
  {q:'Kottayam',state:'Kerala',district:'Kottayam',city:'Kottayam',pin:'686001',lat:9.5916,lng:76.5222},
  {q:'Thiruvananthapuram',state:'Kerala',district:'Thiruvananthapuram',city:'Thiruvananthapuram',pin:'695001',lat:8.5241,lng:76.9366},
  {q:'Kochi',state:'Kerala',district:'Ernakulam',city:'Kochi',pin:'682001',lat:9.9312,lng:76.2673},
  {q:'Kozhikode',state:'Kerala',district:'Kozhikode',city:'Kozhikode',pin:'673001',lat:11.2588,lng:75.7804},
  {q:'Chennai',state:'Tamil Nadu',district:'Chennai',city:'Chennai',pin:'600001',lat:13.0827,lng:80.2707},
  {q:'Coimbatore',state:'Tamil Nadu',district:'Coimbatore',city:'Coimbatore',pin:'641001',lat:11.0168,lng:76.9558},
  {q:'Bengaluru',state:'Karnataka',district:'Bengaluru Urban',city:'Bengaluru',pin:'560001',lat:12.9716,lng:77.5946},
  {q:'Mumbai',state:'Maharashtra',district:'Mumbai City',city:'Mumbai',pin:'400001',lat:19.0760,lng:72.8777},
  {q:'Pune',state:'Maharashtra',district:'Pune',city:'Pune',pin:'411001',lat:18.5204,lng:73.8567},
  {q:'Delhi',state:'Delhi',district:'New Delhi',city:'New Delhi',pin:'110001',lat:28.6139,lng:77.2090},
  {q:'Noida',state:'Uttar Pradesh',district:'Noida (Gautam Buddha Nagar)',city:'Noida',pin:'201301',lat:28.5355,lng:77.3910},
  {q:'Lucknow',state:'Uttar Pradesh',district:'Lucknow',city:'Lucknow',pin:'226001',lat:26.8467,lng:80.9462},
  {q:'Ahmedabad',state:'Gujarat',district:'Ahmedabad',city:'Ahmedabad',pin:'380001',lat:23.0225,lng:72.5714},
  {q:'Kolkata',state:'West Bengal',district:'Kolkata',city:'Kolkata',pin:'700001',lat:22.5726,lng:88.3639},
  {q:'Hyderabad',state:'Telangana',district:'Hyderabad',city:'Hyderabad',pin:'500001',lat:17.3850,lng:78.4867},
  {q:'Jaipur',state:'Rajasthan',district:'Jaipur',city:'Jaipur',pin:'302001',lat:26.9124,lng:75.7873}
];
function mapSearch(prefix){
  const q=(document.getElementById(prefix+'_mapSearch')?.value||'').trim().toLowerCase();
  const box=document.getElementById(prefix+'_mapSuggest'); if(!box)return;
  if(!q){box.innerHTML='';return}
  const matches=GST_MAP_PLACES.filter(p=>p.q.toLowerCase().includes(q)||p.pin.startsWith(q)).slice(0,5);
  box.innerHTML=matches.length?matches.map(p=>`<div class="map-suggest-item" onclick="mapPick('${prefix}','${p.pin}')">${esc(p.q)}, ${esc(p.district)}, ${esc(p.state)} — ${esc(p.pin)}</div>`).join(''):'<div class="map-suggest-item muted">No matches in this offline preview — you can still enter the address fields manually below.</div>';
}
function mapPick(prefix,pin){
  const place=GST_MAP_PLACES.find(p=>p.pin===pin); if(!place)return;
  const d=window.gstPartBData||{};
  d[prefix+'Pincode']=place.pin; d[prefix+'City']=place.city; d[prefix+'District']=place.district;
  if(document.querySelector(`[name="${prefix}State"]`)) d[prefix+'State']=place.state;
  d[prefix+'Lat']=place.lat.toFixed(6); d[prefix+'Lng']=place.lng.toFixed(6);
  // Bug fix: partBTab() calls partBData() first thing on re-render, which re-reads whatever
  // is currently sitting in the DOM inputs and would silently overwrite the values just set
  // above (since the old, still-empty input fields hadn't been updated yet). Update the actual
  // input elements too, before saving/re-rendering, so the values survive the refresh.
  ['Pincode','City','District','Lat','Lng'].forEach(k=>{const el=document.querySelector(`[name="${prefix}${k}"]`);if(el)el.value=d[prefix+k];});
  const stateEl=document.querySelector(`[name="${prefix}State"]`); if(stateEl) stateEl.value=place.state;
  localStorage.setItem('gstPartBData',JSON.stringify(d)); window.gstPartBData=d;
  partBTab(window.gstPartBTab);
  notify('Location set to '+place.q+'. Address fields updated — you can still adjust them manually.');
}
function mapConfirm(prefix){
  partBData();
  const d=window.gstPartBData;
  if(d[prefix+'Pincode']) notify('Location confirmed for '+(d[prefix+'City']||'the selected address')+'.');
  else notify('Search and pick a location, or fill the address fields below, then Confirm.');
}
function addrFields(prefix,opts){opts=opts||{};const withCountry=opts.country;
  return input(prefix+'Building','Building No. / Flat No.','Enter building / flat / door no.','required')+
    input(prefix+'Floor','Floor Number','Enter floor number')+
    input(prefix+'Premises','Name of the Premises / Building','Enter premises / building')+
    input(prefix+'Road','Road / Street','Enter road / street','required')+
    input(prefix+'City','City / Town / Locality / Village','Enter city / town / village','required')+
    (withCountry?select(prefix+'Country','Country',['India','Nepal','Bhutan','Other'],true):'')+
    input(prefix+'Pincode','Pin Code','6 digit PIN','maxlength="6" inputmode="numeric" required')+
    select(prefix+'State','State',STATE_LIST,true)+
    input(prefix+'District','District','Enter district name','required')+
    input(prefix+'Locality','Locality / Sub Locality','Enter locality / sub locality')+
    input(prefix+'Landmark','Nearby Landmark','Enter nearby landmark')+
    input(prefix+'Lat','Latitude','Enter latitude')+
    input(prefix+'Lng','Longitude','Enter longitude')+
    `<div class="full" style="text-align:center;margin-top:6px"><button type="button" class="small-btn" onclick="resetAddress('${prefix}')">&#8635; RESET ADDRESS</button></div>`;
}
const STATE_LIST=['Andaman and Nicobar Islands','Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chandigarh','Chhattisgarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jammu and Kashmir','Jharkhand','Karnataka','Kerala','Ladakh','Lakshadweep','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Puducherry','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
const DISTRICTS_BY_STATE={
  'Jammu and Kashmir':['Srinagar','Jammu','Baramulla','Anantnag','Udhampur','Kathua','Pulwama','Kupwara'],
  'Himachal Pradesh':['Shimla','Kangra','Mandi','Solan','Una','Kullu','Hamirpur','Bilaspur'],
  'Punjab':['Ludhiana','Amritsar','Jalandhar','Patiala','Bathinda','Mohali','Hoshiarpur'],
  'Chandigarh':['Chandigarh'],
  'Uttarakhand':['Dehradun','Haridwar','Nainital','Udham Singh Nagar','Almora','Pauri Garhwal'],
  'Haryana':['Gurugram','Faridabad','Panipat','Karnal','Hisar','Rohtak','Ambala','Sonipat'],
  'Delhi':['New Delhi','North Delhi','South Delhi','East Delhi','West Delhi','Central Delhi','North East Delhi','South West Delhi'],
  'Rajasthan':['Jaipur','Jodhpur','Udaipur','Kota','Ajmer','Bikaner','Alwar','Bharatpur'],
  'Uttar Pradesh':['Lucknow','Kanpur Nagar','Ghaziabad','Agra','Varanasi','Noida (Gautam Buddha Nagar)','Meerut','Prayagraj','Bareilly','Aligarh'],
  'Bihar':['Patna','Gaya','Bhagalpur','Muzaffarpur','Darbhanga','Purnia'],
  'Sikkim':['Gangtok','Namchi','Mangan','Gyalshing'],
  'Arunachal Pradesh':['Itanagar','Naharlagun','Pasighat','Tawang'],
  'Nagaland':['Kohima','Dimapur','Mokokchung','Tuensang'],
  'Manipur':['Imphal East','Imphal West','Thoubal','Churachandpur'],
  'Mizoram':['Aizawl','Lunglei','Champhai','Serchhip'],
  'Tripura':['Agartala','Udaipur','Dharmanagar','Kailashahar'],
  'Meghalaya':['Shillong','Tura','Jowai','Nongstoin'],
  'Assam':['Guwahati (Kamrup Metro)','Dibrugarh','Silchar','Jorhat','Nagaon','Tezpur'],
  'West Bengal':['Kolkata','Howrah','North 24 Parganas','South 24 Parganas','Darjeeling','Hooghly','Nadia','Bardhaman'],
  'Jharkhand':['Ranchi','Jamshedpur (East Singhbhum)','Dhanbad','Bokaro','Hazaribagh'],
  'Odisha':['Bhubaneswar (Khordha)','Cuttack','Puri','Rourkela (Sundargarh)','Berhampur (Ganjam)'],
  'Chhattisgarh':['Raipur','Bilaspur','Durg','Bastar','Korba'],
  'Madhya Pradesh':['Bhopal','Indore','Gwalior','Jabalpur','Ujjain','Sagar'],
  'Gujarat':['Ahmedabad','Surat','Vadodara','Rajkot','Gandhinagar','Bhavnagar','Jamnagar'],
  'Dadra and Nagar Haveli and Daman and Diu':['Daman','Diu','Silvassa'],
  'Maharashtra':['Mumbai City','Mumbai Suburban','Pune','Nagpur','Nashik','Thane','Aurangabad','Kolhapur','Solapur'],
  'Andhra Pradesh':['Visakhapatnam','Vijayawada (NTR)','Guntur','Tirupati','Nellore','Kurnool'],
  'Karnataka':['Bengaluru Urban','Mysuru','Mangaluru (Dakshina Kannada)','Hubballi-Dharwad','Belagavi','Kalaburagi','Shivamogga','Tumakuru'],
  'Goa':['North Goa','South Goa'],
  'Lakshadweep':['Kavaratti'],
  'Kerala':['Thiruvananthapuram','Kollam','Pathanamthitta','Alappuzha','Kottayam','Idukki','Ernakulam','Thrissur','Palakkad','Malappuram','Kozhikode','Wayanad','Kannur','Kasaragod'],
  'Tamil Nadu':['Chennai','Coimbatore','Madurai','Tiruchirappalli','Salem','Tirunelveli','Erode','Vellore','Thanjavur','Kanyakumari'],
  'Puducherry':['Puducherry','Karaikal','Mahe','Yanam'],
  'Andaman and Nicobar Islands':['South Andaman','North and Middle Andaman','Nicobar'],
  'Telangana':['Hyderabad','Rangareddy','Warangal','Nizamabad','Karimnagar','Khammam'],
  'Ladakh':['Leh','Kargil']
};
function resetAddress(prefix){['Pincode','District','City','Locality','Road','Premises','Building','Floor','Landmark','Lat','Lng'].forEach(k=>{const el=document.querySelector(`[name="${prefix}${k}"]`);if(el)el.value='';});notify('Address fields cleared.');}
function addExistingReg(){partBData();const d=window.gstPartBData;const type=document.querySelector('[name="tempRegType"]')?.value,no=(document.querySelector('[name="tempRegNo"]')?.value||'').trim(),date=document.querySelector('[name="tempRegDate"]')?.value;if(!type||!no){notify('Select a registration type and enter the registration number first.');return}d.existingRegistrations=d.existingRegistrations||[];d.existingRegistrations.push({type,no,date});localStorage.setItem('gstPartBData',JSON.stringify(d));partBTab('business')}
function removeExistingReg(i){partBData();window.gstPartBData.existingRegistrations.splice(i,1);localStorage.setItem('gstPartBData',JSON.stringify(window.gstPartBData));partBTab('business')}
function personFieldSet(prefix){
  return `<h4 class="pb-subhead">Personal Information</h4>`+
    input(prefix+'First','First Name','Enter first name','required')+input(prefix+'Middle','Middle Name','Enter middle name')+input(prefix+'Last','Last Name','Enter last name')+
    input(prefix+'FatherFirst','Father\u2019s First Name','Enter first name','required')+input(prefix+'FatherMiddle','Father\u2019s Middle Name','Enter middle name')+input(prefix+'FatherLast','Father\u2019s Last Name','Enter last name')+
    input(prefix+'Dob','Date of Birth','DD/MM/YYYY','type="date" required')+input(prefix+'Mobile','Mobile Number','Enter mobile','maxlength="10" inputmode="numeric" required')+input(prefix+'Email','Email Address','Enter email','type="email" required')+
    `<div class="full"><label class="field">Gender <b>*</b></label><div class="yesno">${['Male','Female','Others'].map(g=>`<label><input type="radio" name="${prefix}Gender" value="${g}" ${(window.gstPartBData||{})[prefix+'Gender']===g?'checked':''}> ${g}</label>`).join('')}</div></div>`+
    input(prefix+'Std','STD Code','STD')+input(prefix+'Telephone','Telephone Number (with STD Code)','Enter telephone number')+
    `<h4 class="pb-subhead full">Identity Information</h4>`+
    input(prefix+'Designation','Designation / Status','Enter designation','required')+input(prefix+'Din','Director Identification Number','Enter DIN Number')+
    toggle(prefix+'Citizen','Are you citizen of India?')+
    input(prefix+'Pan','Permanent Account Number (PAN)','Enter PAN','maxlength="10" style="text-transform:uppercase" required')+input(prefix+'Passport','Passport Number (In case of Foreigner)','Enter Passport Number')+input(prefix+'Aadhaar','Aadhaar Number','Enter Aadhaar Number','maxlength="12" inputmode="numeric"')+
    `<h4 class="pb-subhead full">Residential Address</h4>`+
    `<div class="full pb-note">i. Please be aware that the GST system incorporates mandatory address validations for accuracy and uniformity. These include front-end validations upon entry and back-end cross-checks with GST system geocoding engine.<br><br>ii. Users must ensure that addresses entered align with these validations and any corresponding address proof. Your adherence helps maintain system integrity.</div>`+
    miniMap(prefix+'Res')+
    addrFields(prefix+'Res',{country:true})+
    `<h4 class="pb-subhead full">Document Upload</h4>`+
    `<div class="full upload-block"><label class="field">Upload Photograph (of person whose information has been given above) <b>*</b></label><div class="upload-hint">&#9432; Only JPEG file format is allowed<br>&#9432; Maximum file size for upload 100 KB</div><div class="upload-row2"><input type="file" name="${prefix}Photo" accept=".jpg,.jpeg"><span class="upload-or">OR</span><button type="button" class="small-btn camera-btn" onclick="notify('Camera capture is simulated in this training build.')">&#128247; TAKE PICTURE</button><span class="upload-hint2">&#9432; You can use your device camera to take selfie Photograph</span></div></div>`+
    (prefix==='promo'?`<h4 class="pb-subhead full">Other Information</h4>`+toggle(prefix+'AlsoSignatory','Also Authorized Signatory'):'');
}
function partBTab(tab){
  partBData(); const partA=JSON.parse(localStorage.getItem('gstPartA')||'{}'); window.gstPartBTab=tab;
  document.querySelectorAll('.partb-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  const d=window.gstPartBData||{}; let html='';
  if(tab==='business'){
    const addlNames=d.additionalTradeNames||[];
    const existingRegs=d.existingRegistrations||[];
    html=section('Business Details',
      input('tradeName','Trade Name','Enter Legal Name of Business')+
      select('constitution','Constitution of Business (Select Appropriate)',['Proprietorship','Partnership','Hindu Undivided Family','Private Limited Company','Public Limited Company','Society / Club / Trust / AOP','Government Department','Public Sector Undertaking','Unlimited Company','Limited Liability Partnership','Local Authority','Statutory Body','Foreign LLP','Foreign Company Registered in India','Others'],true)+
      `<div class="full"><label class="field">Additional Trade Name</label><div class="addl-row"><input id="tempAddTradeName" placeholder="Enter Trade Name"><button type="button" class="small-btn add-btn" onclick="addTradeName()">+ ADD</button>${addlNames.length?`<button type="button" class="small-btn cancel-btn" onclick="clearTradeNames()">&#10005; CANCEL</button>`:''}</div><div class="pb-note" style="margin-left:0">You can add up to nine additional trade names.</div>${addlNames.length?`<div class="chip-list">${addlNames.map((n,i)=>`<span class="chip">${esc(n)} <a href="#" onclick="event.preventDefault();removeTradeName(${i})">&times;</a></span>`).join('')}</div>`:''}</div>`+
      `<div class="full state-district-row"><div><label class="field">Name of the State</label><div class="readonly-value">${esc(partA.state||d.state||'-')}</div></div><div>${select('district','District',(DISTRICTS_BY_STATE[partA.state||d.state]||['Select State in Part A first']))}</div></div>`+
      `<div class="full"><label class="field">Reason to obtain registration <b>*</b></label><select name="registrationReason" onchange="partBData();partBTab('business')"><option value="">Select</option>${['Crossing the threshold','Voluntary Basis','Casual Taxable Person','SEZ Unit','SEZ Developer','Input Service Distributor only','Transfer of Business','Merger / De-merger of two or more entities','Amalgamation of two or more entities','Sale','Death of the Proprietor','Change in constitution of business','Corporate Debtor undergoing the Corporate Insolvency Resolution Process with IRP/RP','Others'].map(o=>`<option ${d.registrationReason===o?'selected':''}>${o}</option>`).join('')}</select></div>`+
      input('commencementDate','Date of commencement of Business','','type="date" required')+
      input('liabilityDate','Date on which liability to register arises','','type="date" required')+
      (d.registrationReason==='SEZ Unit'||d.registrationReason==='SEZ Developer'?`<div class="full pb-note" style="margin-left:0">SEZ registrations require the jurisdictional Development Commissioner's approval order to be uploaded.</div>${input('sezApprovalNo','SEZ Approval Order No.','Enter approval order number')}${input('sezApprovalFrom','Period of Validity — From','','type="date"')}${input('sezApprovalTo','Period of Validity — To','','type="date"')}<div class="full upload-block"><label class="field">Upload SEZ Letter of Approval / Letter of Permission (LOA/LOP) <b>*</b></label><div class="upload-hint">&#9432; PDF format only, maximum 2 MB</div><input type="file" name="sezDocFile" accept=".pdf"></div>`:'')+
      (d.registrationReason&&/IRP\/RP/.test(d.registrationReason)?`<div class="full pb-note" style="margin-left:0">Corporate Debtors undergoing CIRP file a fresh registration in the name of the IRP/RP, effective from the date of appointment.</div>${input('irpAppointmentDate','Date of Appointment of IRP/RP','','type="date"')}${input('irpOrderNo','NCLT Order Reference No.','Enter NCLT order reference')}<div class="full upload-block"><label class="field">Upload NCLT Appointment Order <b>*</b></label><div class="upload-hint">&#9432; PDF format only, maximum 2 MB</div><input type="file" name="irpDocFile" accept=".pdf"></div>`:'')+
      toggle('casual','Are you applying for registration as a casual taxable person?')+
      (d.casual==='Yes'?`<div class="full pb-note" style="margin-left:0">A casual taxable person must submit the application at least five days before commencing business, and creates a Challan to make an advance tax deposit.</div>${input('casualEstSupplies','Estimated Supplies (Turnover)','Enter estimated turnover',(''))}${input('casualEstTax','Estimated Net Tax Liability','Enter estimated net tax liability',(''))}<div class="full"><button type="button" class="small-btn" onclick="notify('Challan creation for advance tax deposit is simulated in this training build — see Payments \\u2192 Create Challan.')">CREATE CHALLAN</button></div>`:'')+
      input('estAggregateTurnover','Estimated Aggregate Annual Turnover (₹)','Enter estimated turnover for the FY','type="number"')+
      toggle('composition','Option For Composition')+
      (d.composition==='Yes'?(()=>{const SPECIAL_CAT=['Arunachal Pradesh','Manipur','Meghalaya','Mizoram','Nagaland','Sikkim','Tripura','Uttarakhand'];const st=partA.state||d.state||'';const limit=SPECIAL_CAT.includes(st)?7500000:15000000;const turnover=+d.estAggregateTurnover||0;const over=turnover>0&&turnover>limit;return over?`<div class="full pb-note" style="margin-left:0;background:#fff2f2;border-left-color:#c33;color:#7a1f1f"><b>&#9888; Not eligible for Composition.</b> Estimated turnover (₹${turnover.toLocaleString('en-IN')}) exceeds the ₹${(limit/100000).toFixed(0)} lakh Composition Scheme threshold for ${esc(st)||'this state'} (₹75 lakh for special-category states, ₹1.5 crore otherwise; ₹50 lakh separately for services under Section 10(2A)). Switch Composition off or correct the estimated turnover before continuing.</div>`:'';})():'')+
      (d.composition==='Yes'?`<div class="full"><label class="field">Category of Registered Person <b>*</b></label><div class="yesno" style="flex-direction:column;align-items:flex-start;height:auto;gap:8px">${['Manufacturers (other than notified goods)','Restaurant Service (not serving alcohol)','Traders / Other suppliers eligible for composition','Supplier of Services (Section 10(2A))'].map(c=>`<label style="display:block"><input type="checkbox" name="compCategory_${c.replace(/\W/g,'_')}" ${d['compCategory_'+c.replace(/\W/g,'_')]?'checked':''}> ${c}</label>`).join('')}</div></div><div class="full"><label><input type="checkbox" name="compDeclaration" ${d.compDeclaration?'checked':''}> I hereby declare that I am eligible to opt for the Composition Levy and shall abide by the conditions and restrictions specified in the Act or the rules.</label></div>`:'')+
      `<div class="full"><label class="field">Option for registration under Rule 14A <b>*</b></label><div class="yesno">${['Yes','No'].map(v=>`<label><input type="radio" name="rule14a" value="${v}" ${(d.rule14a===v)||(v==='No'&&!d.rule14a)?'checked':''}> ${v}</label>`).join('')}</div><div class="pb-note" style="margin-left:0">&#9432; You may avail option under Rule 14A if the ITC to be passed on is less than or equal to 2.5 lakhs per month, otherwise please click on 'NO'. Further, to avail said option, Aadhaar Authentication is mandatory. Please note that by filing this application under Rule 14A, you are also declaring that the aforesaid business shall abide by the conditions and restrictions specified in the Act or the rules for opting to register under rule 14A.</div>${d.rule14a==='Yes'?`<div style="margin-top:6px"><label><input type="checkbox" name="rule14aDeclaration" ${d.rule14aDeclaration?'checked':''}> I have read the above declaration and agree to abide by the conditions and restrictions for registration under Rule 14A.</label></div>`:''}</div>`+
      `<h4 class="pb-subhead full">Indicate Existing Registrations</h4>`+
      `<div class="full"><table class="pb-table"><thead><tr><th>Registration Type</th><th>Registration No.</th><th>Date of Registration</th><th></th></tr></thead><tbody>${existingRegs.length?existingRegs.map((r,i)=>`<tr><td>${esc(r.type)}</td><td>${esc(r.no)}</td><td>${esc(r.date)}</td><td><a href="#" onclick="event.preventDefault();removeExistingReg(${i})">Remove</a></td></tr>`).join(''):'<tr><td colspan="4" style="text-align:center;color:#8494a6">None added.</td></tr>'}</tbody></table></div>`+
      select('tempRegType','Registration Type',['Central Sales Tax Registration Number','Central Excise Registration Number','Service Tax Registration Number','State Sales Tax / VAT (Provisional ID)','Other'])+
      input('tempRegNo','Registration No.','Enter registration number')+
      input('tempRegDate','Date of Registration','','type="date"')+
      `<div class="full"><button type="button" class="small-btn" onclick="addExistingReg()">+ ADD</button></div>`,
      '');
  } else if(tab==='promoters'){
    const list=d.promotersList||[];
    html=section('Details of Proprietor',
      personFieldSet('promo'),'')+
      `<div class="pb-listbar"><span>${list.length} Promoter(s) / Partner(s) added</span></div>`+
      (list.length?`<section class="pb-section"><h3>Promoter / Partner List</h3><div class="pb-grid"><div class="full"><table class="pb-table"><thead><tr><th>#</th><th>Name</th><th>Designation</th><th>Mobile</th><th>Email</th><th></th></tr></thead><tbody>${list.map((p,i)=>`<tr><td>${i+1}</td><td>${esc((p.First||'')+' '+(p.Last||''))}</td><td>${esc(p.Designation||'')}</td><td>${esc(p.Mobile||'')}</td><td>${esc(p.Email||'')}</td><td><a href="#" onclick="event.preventDefault();removePromoter(${i})">Remove</a></td></tr>`).join('')}</tbody></table></div></div></section>`:'');
  } else if(tab==='signatory'){
    const list=d.signatoryList||[];
    html=`<section class="pb-section"><h3>Details of Authorized Signatory</h3><div class="pb-grid"><div class="full"><label><input type="checkbox" name="signPrimary" ${d.signPrimary?'checked':''}> Primary Authorized Signatory</label></div>${personFieldSet('sign')}<div class="full upload-block"><label class="field">Proof of details of authorized signatory <b>*</b></label>${select('signProof','',['Letter of Authorisation','Copy of Board Resolution']).replace('<label class="field"></label>','')}<div class="upload-hint">&#9432; File with PDF or JPEG format is only allowed<br>&#9432; Maximum file size for upload 1 MB</div><input type="file" name="signProofFile" accept=".pdf,.jpg,.jpeg"></div></div></section><div class="pb-listbar"><span>${list.length} Signatory(ies) added</span></div>`+
      (list.length?`<section class="pb-section"><h3>Authorized Signatory List</h3><div class="pb-grid"><div class="full"><table class="pb-table"><thead><tr><th>#</th><th>Name</th><th>Designation</th><th>Primary</th><th>Mobile</th><th>Email</th><th></th></tr></thead><tbody>${list.map((p,i)=>`<tr><td>${i+1}</td><td>${esc((p.First||'')+' '+(p.Last||''))}</td><td>${esc(p.Designation||'')}</td><td>${p.primary?'Yes':'No'}</td><td>${esc(p.Mobile||'')}</td><td>${esc(p.Email||'')}</td><td><a href="#" onclick="event.preventDefault();removeSignatory(${i})">Remove</a></td></tr>`).join('')}</tbody></table></div></div></section>`:'');
  } else if(tab==='representative'){
    html=`<section class="pb-section"><h3>Details of Authorized Representative</h3><div class="pb-grid">${toggle('hasRepresentative','Do you have any Authorized Representative?')}</div></section>`;
    if(d.hasRepresentative==='Yes'){
      html+=section('Representative Details',
        select('repType','Type of Representative',['GST Practitioner','Other than GST Practitioner'])+
        input('repEnrollment','Enrolment ID','Enter GSTP enrolment ID')+
        input('repFirst','First Name','Enter first name','required')+input('repMiddle','Middle Name','Enter middle name')+input('repLast','Last Name','Enter last name')+
        input('repDesignation','Designation / Status','Enter designation')+input('repMobile','Mobile Number','Enter mobile','maxlength="10" inputmode="numeric"')+input('repEmail','Email Address','Enter email','type="email"')+
        input('repPan','PAN','Enter PAN','maxlength="10" style="text-transform:uppercase"')+input('repTelephone','Telephone No. with STD','Enter telephone')+input('repFax','Fax No. with STD','Enter fax'),'');
    }
  } else if(tab==='principal'){
    html=`<section class="pb-section"><h3>Details of Principal Place of Business</h3><div class="pb-note" style="margin:10px 12px 0">i. Please be aware that the GST system incorporates mandatory address validations for accuracy and uniformity. These include front-end validations upon entry and back-end cross-checks with GST system geocoding engine.<br><br>ii. Users must ensure that addresses entered align with these validations and any corresponding address proof. Your adherence helps maintain system integrity.</div><div class="pb-grid"><h4 class="pb-subhead full">Address</h4>${miniMap('prin')}${addrFields('prin')}<h4 class="pb-subhead full">Jurisdiction</h4><div class="full jurisdiction-box"><div class="jur-title">State Jurisdiction</div>${input('prinCircle','Circle','Auto-filled from state')}${input('prinSCWCU','Sector / Circle / Ward / Charge / Unit','Enter jurisdiction unit','required')}</div><div class="full jurisdiction-box"><div class="jur-title">Centre Jurisdiction <a href="#" onclick="event.preventDefault();notify('Refer the CBIC jurisdiction locator (link simulated).')" style="font-weight:400">(Refer the link for center Jurisdiction)</a></div>${input('prinCommissionerate','Commissionerate','Enter commissionerate','required')}${input('prinDivision','Division','Enter division','required')}${input('prinRange','Range','Enter range','required')}</div><h4 class="pb-subhead full">Contact Information</h4>${input('prinOfficeEmail','Office Email Address','Enter office email','type="email" required')}${input('prinOfficeStd','STD','STD')}${input('prinOfficePhone','Office Telephone Number','Enter telephone number')}${input('prinMobile','Mobile Number','Enter mobile','maxlength="10" inputmode="numeric" required')}${input('prinFax','Office Fax Number (with STD Code)','Enter fax number')}<h4 class="pb-subhead full">Nature of possession of premises</h4>${select('prinNature','Please Select',['Own','Leased','Rented','Consent','Shared','Others'],true)}<div class="full upload-block"><label class="field">Document Upload <b>*</b></label>${select('prinProof','Proof of Principal Place of Business',['Legal ownership document','Municipal Khata copy','Property Tax Receipt','Rent / Lease agreement','Consent Letter','Electricity Bill','Others'],true)}<div class="upload-hint">&#9432; File with PDF or JPEG format is only allowed<br>&#9432; Maximum file size for upload 1 MB</div><input type="file" name="prinProofFile" accept=".pdf,.jpg,.jpeg"></div><h4 class="pb-subhead full">Nature of Business Activity being carried out at above mentioned premises</h4><div class="full check-grid">${['Bonded Warehouse','EOU / STP / EHTP','Export','Factory / Manufacturing','Import','Supplier of Services','Leasing Business','Office / Sale Office','Recipient of Goods or Services','Retail Business','Warehouse / Depot','Wholesale Business','Works Contract','Others (Please Specify)'].map(x=>`<label><input type="checkbox" name="prinact_${x.replace(/\W/g,'_')}" ${d['prinact_'+x.replace(/\W/g,'_')]?'checked':''}> ${x}</label>`).join('')}</div>${toggle('haveAdditional','Have Additional Place of Business')}</div></section>`;
  } else if(tab==='additional'){
    if(d.haveAdditional!=='Yes'){
      html=`<section class="pb-section"><h3>Details of Additional Places of your Business</h3><div class="pb-grid"><div class="full pb-note">&#9432; Important! If you need to add details on additional places of business:<br>1. Go to <b>Principal Place of Business</b> tab.<br>2. Select <b>Yes</b> for <b>Have Additional Places of Business</b></div></div></section>`;
    } else {
      const list=d.additionalPlacesList||[];
      html=`<section class="pb-section"><h3>Details of Additional Place of Business</h3><div class="pb-grid">${miniMap('addl')}${addrFields('addl')}<h4 class="pb-subhead full">Nature of Business Activity</h4><div class="full check-grid">${['Bonded Warehouse','EOU / STP / EHTP','Export','Factory / Manufacturing','Import','Supplier of Services','Leasing Business','Office / Sale Office','Recipient of Goods or Services','Retail Business','Warehouse / Depot','Wholesale Business','Works Contract','Others (Please Specify)'].map(x=>`<label><input type="checkbox" name="addlact_${x.replace(/\W/g,'_')}" ${d['addlact_'+x.replace(/\W/g,'_')]?'checked':''}> ${x}</label>`).join('')}</div></div></section><div class="pb-listbar"><span>${list.length} Additional Place(s) added</span></div>`;
    }
  } else if(tab==='goods'){
    const sub=window.gstGoodsSubTab||'goods';
    const goodsList=d.goodsList||[]; const servicesList=d.servicesList||[];
    const HSN=[['1001','Wheat And Meslin - Durum Wheat'],['1006','Rice'],['1006 30','Semi-Milled Or Wholly-Milled Rice, Whether Or Not Polished Or Glazed'],['0811','Fruit And Nuts, Uncooked Or Cooked By Steaming Or Boiling In Water, Frozen'],['0901','Coffee'],['1806','Chocolate And Other Food Preparations Containing Cocoa'],['2101','Coffee/Tea Extracts, Essences And Concentrates'],['2710','Petroleum Oils And Oils Obtained From Bituminous Minerals, Other Than Crude'],['2710 12','Petroleum Oils And Oils Obtained From Bituminous Minerals (Light Oils And Preparations)'],['3004','Medicaments (Excluding Goods Of Heading 3002, 3005 Or 3006)'],['4201','Saddlery And Harness For Any Animal, Of Any Material'],['4202','Trunks, Suit-Cases, Vanity-Cases, Executive-Cases, Brief-Cases, School Satchels'],['4801','Newsprint, In Rolls Or Sheets'],['4802','Uncoated Paper And Paperboard, Of A Kind Used For Writing, Printing'],['4802 10','Uncoated Kraft Paper And Paperboard, In Rolls Or Sheets'],['4804','Hand-Made Paper And Paperboard'],['4818','Toilet Paper And Similar Paper, Cellulose Wadding Or Webs Of Cellulose Fibres'],['5208','Woven Fabrics Of Cotton, Containing 85% Or More By Weight Of Cotton'],['6109','T-Shirts, Singlets And Other Vests, Knitted Or Crocheted'],['6404','Footwear With Outer Soles Of Rubber, Plastics, Leather Or Composition Leather'],['6901','Bricks, Blocks, Tiles And Other Ceramic Goods Of Siliceous Fossil Meals'],['6910','Ceramic Sinks, Wash Basins, Baths, Bidets, Water Closet Pans'],['7009','Glass Mirrors, Whether Or Not Framed, Including Rear-View Mirrors'],['7113','Articles Of Jewellery And Parts Thereof, Of Precious Metal'],['8308','Clasps, Frames With Clasps, Buckles, Buckle-Clasps, Hooks, Eyelets And The Like, Of Base Metal'],['8471','Automatic Data Processing Machines And Units Thereof (Computers)'],['8515','Electric (Including Electrically Heated Gas), Laser Or Other Light Or Photo Beam Welding Machines'],['8517','Telephone Sets, Including Telephones For Cellular Networks Or For Other Wireless Networks'],['8534','Printed Circuits'],['9403','Other Furniture And Parts Thereof'],['9954','Construction Services'],['9962','Sale Or Purchase Of Goods'],['9973','Leasing Or Rental Services Without Operator'],['9983','Other Professional, Technical And Business Services'],['9985','Support Services'],['27101211','Petroleum Oils And Oils Obtained From Bituminous Minerals, Not Elsewhere Specified Or Included']];
    html=`<section class="pb-section"><div class="goods-tabs"><button class="${sub==='goods'?'active':''}" onclick="switchGoodsTab('goods')">Goods</button><button class="${sub==='services'?'active':''}" onclick="switchGoodsTab('services')">Services</button></div>`+
    (sub==='goods'?`<div class="pb-grid"><h4 class="pb-subhead full">Details of Goods / Commodities supplied by the business</h4><div class="full">Please specify top 5 Commodities</div><div class="full"><label class="field">Search HSN Chapter by Name or Code</label><select id="hsnPick"><option value="">Select</option>${HSN.map(h=>`<option value="${h[0]}">${h[0]} - ${h[1]}</option>`).join('')}</select> <button type="button" class="small-btn" onclick="addGoodsHsn()">+ ADD</button></div>${goodsList.length?`<div class="full"><table class="pb-table"><thead><tr><th>#</th><th>HSN Code</th><th>Description</th><th></th></tr></thead><tbody>${goodsList.map((g,i)=>`<tr><td>${i+1}</td><td>${esc(g.code)}</td><td>${esc(g.desc)}</td><td><a href="#" onclick="event.preventDefault();removeGoods(${i})">Remove</a></td></tr>`).join('')}</tbody></table></div>`:''}</div>`:
    `<div class="pb-grid"><h4 class="pb-subhead full">Details of Services supplied by the business</h4><div class="full">Please specify top 5 Services</div><div class="full"><label class="field">Search SAC by Name or Code</label><select id="sacPick"><option value="">Select</option>${HSN.filter(h=>h[0].startsWith('99')).map(h=>`<option value="${h[0]}">${h[0]} - ${h[1]}</option>`).join('')}</select> <button type="button" class="small-btn" onclick="addServiceSac()">+ ADD</button></div>${servicesList.length?`<div class="full"><table class="pb-table"><thead><tr><th>#</th><th>SAC Code</th><th>Description</th><th></th></tr></thead><tbody>${servicesList.map((g,i)=>`<tr><td>${i+1}</td><td>${esc(g.code)}</td><td>${esc(g.desc)}</td><td><a href="#" onclick="event.preventDefault();removeService(${i})">Remove</a></td></tr>`).join('')}</tbody></table></div>`:''}</div>`)+
    `</section>`;
  } else if(tab==='state'){
    html=section('State Specific Information',
      input('professionTaxEC','Professional Tax Employee Code (EC) No.','Enter Professional Tax E.C Number')+
      input('professionTaxRC','Professional Tax Registration Certificate (RC) No.','Enter Professional Tax R.C Number')+
      input('exciseLicense','State Excise License No.','Enter State Excise License Number')+
      input('exciseHolder','Name of the person in whose name Excise Licence is held','Enter Name of the person in whose name Excise Licence is held'),'');
  } else if(tab==='aadhaar'){
    const people=[...(d.promotersList||[]).map(p=>({...p,role:'Promoter/Partner'})),...(d.signatoryList||[]).map(p=>({...p,role:'Primary Authorized Signatory'}))];
    html=`<section class="pb-section"><h3>Aadhaar Authentication</h3><div class="pb-grid"><div class="full"><label class="field">Do you want to opt for Aadhaar Authentication of details of Promoter/Partner, Primary Authorized Signatory added by you? <b>*</b></label><label class="switch"><input type="checkbox" name="aadhaarOptIn" data-toggle="1" value="Yes" ${d.aadhaarOptIn!=='No'?'checked':''}><span class="slider"></span></label><div class="pb-note" style="margin-left:0">By default this is set to <b>Yes</b>, matching the real GST portal. If your Constitution of Business is a Proprietorship, Partnership, or HUF, at least one Promoter/Partner plus the Primary Authorized Signatory must be Aadhaar-authenticated to submit.</div></div><div class="full pb-note">1. Authentication request shall be shared on mobile number, email upon submission of application of Promoter/Partner, and Primary Authorized Signature which are selected.<br>2. ARN would be generated once Aadhaar Authentication exercise is completed for all applicable persons whose name are selected in this table.<br>3. Kindly select at least one person from Promoter/Partner for Aadhaar Authentication</div><div class="full"><table class="pb-table aadhaar-table"><thead><tr><th>Select</th><th>Sl No</th><th>Name</th><th>Citizen/Resident of India</th><th>Promoter/Partner</th><th>Primary Authorized Signatory</th><th>Designation</th><th>Email Address</th><th>Mobile Number</th><th>Status</th></tr></thead><tbody>${people.length?people.map((p,i)=>`<tr><td><input type="checkbox" data-aadhaar-select="${i}" ${(d.aadhaarSelected||[]).includes(i)?'checked':''}></td><td>${i+1}</td><td>${esc((p.First||'')+' '+(p.Last||''))}</td><td>${p.Citizen==='Yes'?'Yes':'No'}</td><td>${p.role==='Promoter/Partner'?'Yes':'No'}</td><td>${p.role==='Primary Authorized Signatory'?'Yes':'No'}</td><td>${esc(p.Designation||'')}</td><td>${esc(p.Email||'')}</td><td>${esc(p.Mobile||'')}</td><td><span class="gst-status orange">Pending</span></td></tr>`).join(''):`<tr><td colspan="10" style="text-align:center;color:#8494a6">Add Promoter/Partner and Authorized Signatory details first.</td></tr>`}</tbody></table><div class="pb-note">Note: Please make sure that email and mobile number of Promoters/Partners, Primary Authorized Signatory Provided by you are correct. The Aadhaar validation links shall be forwarded on the emails/ Mobile No.s provided by you.</div></div></div></section>`;
  } else if(tab==='verification'){
    const sig=(d.signatoryList||[])[0]||{};
    const signName=d.signFirst&&d.signLast?`${d.signFirst} ${d.signLast}`:(sig.First&&sig.Last?`${sig.First} ${sig.Last}`:'');
    const today=new Date();
    const todayStr=String(today.getDate()).padStart(2,'0')+'/'+String(today.getMonth()+1).padStart(2,'0')+'/'+today.getFullYear();
    html=`<section class="pb-section"><h3>Verification</h3><div class="pb-grid"><div class="full pb-consent"><label><input type="checkbox" name="declaration" ${d.declaration?'checked':''}> I hereby solemnly affirm and declare that the information given herein above is true and correct to the best of my knowledge and belief and nothing has been concealed therefrom.</label></div>${select('verificationSignatory','Name of Authorized Signatory',signName?[signName]:['Select after adding Authorized Signatory'],true)}${input('verificationPlace','Place','Enter Place','required')}${input('verificationDesignation','Designation / Status','Enter Designation','required value="'+esc(d.signDesignation||sig.Designation||'')+'"')}<div><label class="field">Date</label><div class="readonly-value">${todayStr}</div></div><div class="full"><div class="pb-note">&#9432; DSC is compulsory for Companies &amp; LLP</div><div class="pb-note">&#9432; <a href="#" onclick="event.preventDefault();notify('DSC troubleshooting help (simulated).')">Facing Problem using DSC? click here for help</a></div></div><div class="full submit-note">Click Submit — if anything mandatory is still missing, it'll be listed below with a link that jumps you straight to it.</div><div class="full signature-box"><div class="submit-methods"><button type="button" id="submitDscBtn" onclick="window.submitPartBFinal('DSC')">SUBMIT WITH DSC</button><button type="button" id="submitEvcBtn" onclick="window.submitPartBFinal('EVC')">SUBMIT WITH EVC</button></div><div class="demo-note">Training simulator: EVC/DSC authentication is simulated locally; no GSTN/UIDAI service is contacted.</div></div></div></section>`;
  }
  document.getElementById('partBPanel').innerHTML=html;
  if(tab==='principal' && !val('prinState')) setVal('prinState',partA.state||'');
  if(tab==='business'){
    if(!val('state'))setVal('state',partA.state||'');
    if(!val('district'))setVal('district',partA.district||'');
  }
  bindPANInputs(); bindToggles(); initAllMiniMaps(); markCompletedTabs();
  if(tab==='aadhaar') bindAadhaarSelect();
  if(tab==='verification') refreshVerifyState();
  if(window.gstRegSubmitAttempted) markRequiredFieldErrors();
  const pctEl=document.getElementById('regProfilePct'); if(pctEl) pctEl.textContent=regProfilePercent()+'%';
  const lmEl=document.getElementById('regLastModified'); if(lmEl){const t=new Date();lmEl.textContent=String(t.getDate()).padStart(2,'0')+'/'+String(t.getMonth()+1).padStart(2,'0')+'/'+t.getFullYear();}
  const footer=document.getElementById('partBFooterActions');
  if(footer){
    if(tab==='promoters'){footer.innerHTML=`<button class="partb-save" onclick="showPromoterList()">SHOW LIST</button><button class="partb-save" onclick="addNewPromoter()">ADD NEW</button><button class="reg-proceed partb-next" onclick="partBNext()">SAVE &amp; CONTINUE</button>`;}
    else if(tab==='signatory'){footer.innerHTML=`<button class="partb-save" onclick="showSignatoryList()">SHOW LIST</button><button class="partb-save" onclick="addNewSignatory()">ADD NEW</button><button class="reg-proceed partb-next" onclick="partBNext()">SAVE &amp; CONTINUE</button>`;}
    else if(tab==='additional' && d.haveAdditional==='Yes'){footer.innerHTML=`<button class="partb-save" onclick="showAdditionalPlaceList()">SHOW LIST</button><button class="partb-save" onclick="addNewAdditionalPlace()">ADD NEW</button><button class="reg-proceed partb-next" onclick="partBNext()">SAVE &amp; CONTINUE</button>`;}
    else if(tab==='additional'){footer.innerHTML=`<button class="partb-save" disabled title="Enable 'Have Additional Place of Business' in the Principal Place tab first">SHOW LIST</button><button class="partb-save" disabled title="Enable 'Have Additional Place of Business' in the Principal Place tab first">ADD NEW</button><button class="reg-proceed partb-next" onclick="partBNext()">SAVE &amp; CONTINUE</button>`;}
    else if(tab==='verification'){footer.innerHTML=`<button class="partb-save" onclick="savePartB()">SAVE DRAFT</button>`;}
    else {footer.innerHTML=`<button class="partb-save" onclick="savePartB()">SAVE DRAFT</button><button class="reg-proceed partb-next" onclick="partBNext()">SAVE &amp; CONTINUE</button>`;}
  }
  document.getElementById('partBPanel').scrollIntoView({behavior:'smooth',block:'start'});
}
function bindToggles(){document.querySelectorAll('[data-toggle]').forEach(cb=>{cb.addEventListener('change',()=>{partBData();partBTab(window.gstPartBTab);});});}
function bindAadhaarSelect(){document.querySelectorAll('[data-aadhaar-select]').forEach(cb=>{cb.addEventListener('change',()=>{const idx=+cb.dataset.aadhaarSelect;const sel=new Set(window.gstPartBData.aadhaarSelected||[]);if(cb.checked)sel.add(idx);else sel.delete(idx);window.gstPartBData.aadhaarSelected=[...sel];localStorage.setItem('gstPartBData',JSON.stringify(window.gstPartBData));});});}
function switchGoodsTab(t){partBData();window.gstGoodsSubTab=t;partBTab('goods');}
function addGoodsHsn(){partBData();const sel=document.getElementById('hsnPick');const opt=sel?.options[sel.selectedIndex];if(!sel||!sel.value){notify('Select an HSN code first.');return}const d=window.gstPartBData;d.goodsList=d.goodsList||[];d.goodsList.push({code:sel.value,desc:opt.textContent.split(' - ')[1]||''});localStorage.setItem('gstPartBData',JSON.stringify(d));partBTab('goods');}
function removeGoods(i){partBData();window.gstPartBData.goodsList.splice(i,1);localStorage.setItem('gstPartBData',JSON.stringify(window.gstPartBData));partBTab('goods');}
function addServiceSac(){partBData();const sel=document.getElementById('sacPick');const opt=sel?.options[sel.selectedIndex];if(!sel||!sel.value){notify('Select a SAC code first.');return}const d=window.gstPartBData;d.servicesList=d.servicesList||[];d.servicesList.push({code:sel.value,desc:opt.textContent.split(' - ')[1]||''});localStorage.setItem('gstPartBData',JSON.stringify(d));partBTab('goods');}
function removeService(i){partBData();window.gstPartBData.servicesList.splice(i,1);localStorage.setItem('gstPartBData',JSON.stringify(window.gstPartBData));partBTab('goods');}
function addTradeName(){partBData();const el=document.getElementById('tempAddTradeName');const v=(el?.value||'').trim();if(!v){notify('Enter a trade name to add.');return}const d=window.gstPartBData;d.additionalTradeNames=d.additionalTradeNames||[];d.additionalTradeNames.push(v);localStorage.setItem('gstPartBData',JSON.stringify(d));partBTab('business');}
function removeTradeName(i){partBData();window.gstPartBData.additionalTradeNames.splice(i,1);localStorage.setItem('gstPartBData',JSON.stringify(window.gstPartBData));partBTab('business');}
function clearTradeNames(){partBData();window.gstPartBData.additionalTradeNames=[];localStorage.setItem('gstPartBData',JSON.stringify(window.gstPartBData));partBTab('business');}
function addNewPromoter(){
  partBData();const d=window.gstPartBData;const req=['promoFirst','promoMobile','promoEmail','promoDesignation','promoPan'];
  const missing=req.filter(k=>!d[k]);
  if(missing.length){flagMissing(missing);showAddPersonError('promoters',missing);return;}
  clearAddPersonError('promoters');
  const rec={};Object.keys(d).forEach(k=>{if(k.startsWith('promo')&&!/^promoterslist$/i.test(k))rec[k.replace(/^promo/,'')]=d[k];});
  d.promotersList=d.promotersList||[];d.promotersList.push(rec);
  ['First','Middle','Last','FatherFirst','FatherMiddle','FatherLast','Dob','Mobile','Email','Gender','Std','Telephone','Designation','Din','Citizen','Pan','Passport','Aadhaar','ResPincode','ResState','ResCountry','ResDistrict','ResCity','ResLocality','ResRoad','ResPremises','ResBuilding','ResFloor','ResLandmark','ResLat','ResLng','Photo','AlsoSignatory'].forEach(k=>delete d['promo'+k]);
  localStorage.setItem('gstPartBData',JSON.stringify(d));notify('Promoter/Partner added — see the list below.');partBTab('promoters');
}
const ADD_PERSON_FIELD_LABELS={promoFirst:'First Name',promoMobile:'Mobile Number',promoEmail:'Email Address',promoDesignation:'Designation / Status',promoPan:'PAN',signFirst:'First Name',signMobile:'Mobile Number',signEmail:'Email Address',signDesignation:'Designation / Status',signPan:'PAN'};
function showAddPersonError(tab,missing){
  const panel=document.getElementById('partBPanel'); if(!panel)return;
  let box=document.getElementById('addPersonError');
  if(!box){box=document.createElement('div');box.id='addPersonError';box.className='reg-message error';panel.insertBefore(box,panel.firstChild);}
  box.innerHTML='<b>⚠ Nothing was added — fill these first:</b><ul>'+missing.map(k=>`<li>${ADD_PERSON_FIELD_LABELS[k]||k}</li>`).join('')+'</ul>';
  box.style.display='block';
  box.scrollIntoView({behavior:'smooth',block:'center'});
}
function clearAddPersonError(){const box=document.getElementById('addPersonError'); if(box)box.remove();}
function showPromoterList(){
  const d=window.gstPartBData||{};const list=d.promotersList||[];
  const box=document.getElementById('partBPanel');
  box.insertAdjacentHTML('beforeend',`<section class="pb-section"><h3>Promoter / Partner List</h3><div class="pb-grid"><div class="full"><table class="pb-table"><thead><tr><th>#</th><th>Name</th><th>Designation</th><th>Mobile</th><th>Email</th><th></th></tr></thead><tbody>${list.length?list.map((p,i)=>`<tr><td>${i+1}</td><td>${esc((p.First||'')+' '+(p.Last||''))}</td><td>${esc(p.Designation||'')}</td><td>${esc(p.Mobile||'')}</td><td>${esc(p.Email||'')}</td><td><a href="#" onclick="event.preventDefault();removePromoter(${i})">Remove</a></td></tr>`).join(''):'<tr><td colspan="6" style="text-align:center;color:#8494a6">No promoters/partners added yet.</td></tr>'}</tbody></table></div></div></section>`);
}
function removePromoter(i){partBData();window.gstPartBData.promotersList.splice(i,1);localStorage.setItem('gstPartBData',JSON.stringify(window.gstPartBData));partBTab('promoters');}
function addNewSignatory(){
  partBData();const d=window.gstPartBData;const req=['signFirst','signMobile','signEmail','signDesignation','signPan'];
  const missing=req.filter(k=>!d[k]);
  if(missing.length){flagMissing(missing);showAddPersonError('signatory',missing);return;}
  clearAddPersonError('signatory');
  const rec={};Object.keys(d).forEach(k=>{if(k.startsWith('sign')&&k!=='signatoryList'&&k!=='signPrimary'&&k!=='signProof'&&k!=='signProofFile')rec[k.replace(/^sign/,'')]=d[k];});
  rec.primary=!!d.signPrimary;
  d.signatoryList=d.signatoryList||[];
  if(rec.primary)d.signatoryList.forEach(s=>s.primary=false);
  d.signatoryList.push(rec);
  ['First','Middle','Last','FatherFirst','FatherMiddle','FatherLast','Dob','Mobile','Email','Gender','Std','Telephone','Designation','Din','Citizen','Pan','Passport','Aadhaar','ResPincode','ResState','ResCountry','ResDistrict','ResCity','ResLocality','ResRoad','ResPremises','ResBuilding','ResFloor','ResLandmark','ResLat','ResLng','Photo','Primary'].forEach(k=>delete d['sign'+k]);
  localStorage.setItem('gstPartBData',JSON.stringify(d));notify('Authorized Signatory added.');partBTab('signatory');
}
function showSignatoryList(){
  const d=window.gstPartBData||{};const list=d.signatoryList||[];
  const box=document.getElementById('partBPanel');
  box.insertAdjacentHTML('beforeend',`<section class="pb-section"><h3>Authorized Signatory List</h3><div class="pb-grid"><div class="full"><table class="pb-table"><thead><tr><th>#</th><th>Name</th><th>Designation</th><th>Primary</th><th>Mobile</th><th>Email</th><th></th></tr></thead><tbody>${list.length?list.map((p,i)=>`<tr><td>${i+1}</td><td>${esc((p.First||'')+' '+(p.Last||''))}</td><td>${esc(p.Designation||'')}</td><td>${p.primary?'Yes':'No'}</td><td>${esc(p.Mobile||'')}</td><td>${esc(p.Email||'')}</td><td><a href="#" onclick="event.preventDefault();removeSignatory(${i})">Remove</a></td></tr>`).join(''):'<tr><td colspan="7" style="text-align:center;color:#8494a6">No authorized signatories added yet.</td></tr>'}</tbody></table></div></div></section>`);
}
function removeSignatory(i){partBData();window.gstPartBData.signatoryList.splice(i,1);localStorage.setItem('gstPartBData',JSON.stringify(window.gstPartBData));partBTab('signatory');}
function addNewAdditionalPlace(){
  partBData();const d=window.gstPartBData;const req=['addlPincode','addlCity','addlBuilding','addlRoad'];
  const missing=req.filter(k=>!d[k]);
  if(missing.length){flagMissing(missing);notify('Fill mandatory address fields before adding.');return;}
  const rec={};Object.keys(d).forEach(k=>{if(k.startsWith('addl')&&k!=='additionalPlacesList')rec[k.replace(/^addl/,'')]=d[k];});
  d.additionalPlacesList=d.additionalPlacesList||[];d.additionalPlacesList.push(rec);
  Object.keys(d).forEach(k=>{if(k.startsWith('addl')&&k!=='additionalPlacesList')delete d[k];});
  localStorage.setItem('gstPartBData',JSON.stringify(d));notify('Additional place added.');partBTab('additional');
}
function showAdditionalPlaceList(){
  const d=window.gstPartBData||{};const list=d.additionalPlacesList||[];
  const box=document.getElementById('partBPanel');
  box.insertAdjacentHTML('beforeend',`<section class="pb-section"><h3>Additional Places List</h3><div class="pb-grid"><div class="full"><table class="pb-table"><thead><tr><th>#</th><th>Building</th><th>City</th><th>Pin Code</th><th></th></tr></thead><tbody>${list.length?list.map((p,i)=>`<tr><td>${i+1}</td><td>${esc(p.Building||'')}</td><td>${esc(p.City||'')}</td><td>${esc(p.Pincode||'')}</td><td><a href="#" onclick="event.preventDefault();removeAdditionalPlace(${i})">Remove</a></td></tr>`).join(''):'<tr><td colspan="5" style="text-align:center;color:#8494a6">No additional places added yet.</td></tr>'}</tbody></table></div></div></section>`);
}
function removeAdditionalPlace(i){partBData();window.gstPartBData.additionalPlacesList.splice(i,1);localStorage.setItem('gstPartBData',JSON.stringify(window.gstPartBData));partBTab('additional');}
function flagMissing(names){names.forEach(n=>{const el=document.querySelector(`[name="${n}"]`);if(el)el.classList.add('field-error');});}
function markRequiredFieldErrors(){
  document.querySelectorAll('#partBPanel [required], #partBPanel input[name$="Pincode"], #partBPanel input[name$="Pan"]').forEach(el=>{
    const v=(el.value||'').trim();
    el.classList.toggle('field-error',!v);
  });
}
function savePartB(){partBData();notify('Part-B draft saved locally.');}
function partBNext(){
  const d=partBData();
  // Real portal marks a tab's icon with a checkmark once you SAVE & CONTINUE past it.
  d.completedTabs=d.completedTabs||[];
  if(!d.completedTabs.includes(window.gstPartBTab)) d.completedTabs.push(window.gstPartBTab);
  localStorage.setItem('gstPartBData',JSON.stringify(d));
  const tabs=['business','promoters','signatory','representative','principal','additional','goods','state','aadhaar','verification'];
  const i=tabs.indexOf(window.gstPartBTab); if(i<tabs.length-1)partBTab(tabs[i+1]); else partBTab('verification');
}
function markCompletedTabs(){
  // Small checkmark badge over a tab's icon once you've SAVE & CONTINUE-d past it,
  // matching the real portal's Part-B tab strip.
  const d=window.gstPartBData||{}; const done=d.completedTabs||[];
  document.querySelectorAll('#partBTabs button').forEach(b=>{
    b.classList.toggle('tab-done',done.includes(b.dataset.tab));
  });
}
function partBBack(){
  partBData();
  const tabs=['business','promoters','signatory','representative','principal','additional','goods','state','aadhaar','verification'];
  const i=tabs.indexOf(window.gstPartBTab); if(i>0)partBTab(tabs[i-1]);
}
function refreshVerifyState(){
  // Buttons are intentionally never disabled — submitPartBFinal() already
  // gives a much better experience: on click it lists exactly what's
  // missing (with links) and jumps you to the first incomplete tab. A
  // disabled button gives zero feedback when clicked, which is what was
  // actually happening before — clicking did nothing, with no error shown.
  document.querySelectorAll('#partBPanel input,#partBPanel select').forEach(el=>{
    el.removeEventListener('input',refreshVerifyStateBound); el.addEventListener('input',refreshVerifyStateBound);
    el.removeEventListener('change',refreshVerifyStateBound); el.addEventListener('change',refreshVerifyStateBound);
  });
}
function refreshVerifyStateBound(){partBData();}
function validatePartB(){
  const d=window.gstPartBData||{}; const errors=[];
  if(!d.tradeName) errors.push({tab:'business',field:'tradeName',msg:'Enter the Trade Name in Business Details.'});
  if(!d.constitution) errors.push({tab:'business',field:'constitution',msg:'Select Constitution of Business.'});
  if(!d.rule14a) errors.push({tab:'business',field:null,msg:'Select an option for registration under Rule 14A.'});
  if(d.rule14a==='Yes' && !d.rule14aDeclaration) errors.push({tab:'business',field:null,msg:'Select the Rule 14A declaration checkbox before continuing.'});
  if(d.rule14a==='Yes' && d.aadhaarOptIn==='No') errors.push({tab:'aadhaar',field:null,msg:"Rule 14A registration requires Aadhaar Authentication — you can't select No for Aadhaar while Rule 14A is Yes."});
  if(d.composition==='Yes' && !d.compDeclaration) errors.push({tab:'business',field:null,msg:'Select the Composition Levy declaration checkbox before continuing.'});
  if(d.composition==='Yes'){const SPECIAL_CAT=['Arunachal Pradesh','Manipur','Meghalaya','Mizoram','Nagaland','Sikkim','Tripura','Uttarakhand'];const st=d.state||'';const limit=SPECIAL_CAT.includes(st)?7500000:15000000;const turnover=+d.estAggregateTurnover||0;if(turnover>limit) errors.push({tab:'business',field:'estAggregateTurnover',msg:`Estimated turnover exceeds the Composition Scheme threshold (₹${(limit/100000).toFixed(0)} lakh) for this state — switch Composition off or correct the turnover.`});}
  // Real REG-01 requires at least one Promoter/Partner entry to be added
  // (the exact legal minimum — e.g. 2 for a Partnership/LLP, 2+ directors
  // for a Company — is a business-constitution rule, not something the
  // portal's frontend hard-blocks submission on). Requiring only 1 here
  // matches what the live portal actually enforces before ARN generation.
  if(!(d.promotersList&&d.promotersList.length>=1)) errors.push({tab:'promoters',field:null,msg:'Add at least one Promoter / Partner (use ADD NEW).'});
  if(!(d.signatoryList&&d.signatoryList.length)) errors.push({tab:'signatory',field:null,msg:'Add at least one Authorized Signatory (use ADD NEW).'});
  if(d.signatoryList&&d.signatoryList.length&&!d.signatoryList.some(s=>s.primary)) errors.push({tab:'signatory',field:null,msg:"Mark one Authorized Signatory as 'Primary Authorized Signatory'."});
  if(!d.prinBuilding||!d.prinRoad||!d.prinCity) errors.push({tab:'principal',field:'prinBuilding',msg:'Complete the Principal Place of Business address.'});
  if(!/^\d{6}$/.test(d.prinPincode||'')) errors.push({tab:'principal',field:'prinPincode',msg:'Enter a valid 6-digit PIN Code for the Principal Place of Business.'});
  if(!d.prinSCWCU) errors.push({tab:'principal',field:'prinSCWCU',msg:'Enter Sector / Circle / Ward / Charge / Unit (State Jurisdiction).'});
  if(!d.prinCommissionerate||!d.prinDivision||!d.prinRange) errors.push({tab:'principal',field:'prinCommissionerate',msg:'Complete the Centre Jurisdiction (Commissionerate / Division / Range).'});
  if(!d.prinMobile) errors.push({tab:'principal',field:'prinMobile',msg:'Enter a Mobile Number for the Principal Place of Business.'});
  if(!d.prinOfficeEmail) errors.push({tab:'principal',field:'prinOfficeEmail',msg:'Enter an Office Email Address for the Principal Place of Business.'});
  if(d.haveAdditional==='Yes' && !(d.additionalPlacesList&&d.additionalPlacesList.length)) errors.push({tab:'additional',field:null,msg:'Add at least one Additional Place of Business, or switch the toggle off in Principal Place of Business.'});
  if(d.signPan && !isValidPANFormat(d.signPan)) errors.push({tab:'signatory',field:'signPan',msg:'Enter a valid 10-character PAN for the Authorized Signatory being added.'});
  if(d.aadhaarOptIn!=='No' && !((d.aadhaarSelected||[]).length)) errors.push({tab:'aadhaar',field:null,msg:'Select at least one person from the Aadhaar Authentication table (at least one Promoter/Partner is required).'});
  if(!d.declaration) errors.push({tab:'verification',field:null,msg:'Accept the Verification declaration before submission.'});
  if(!d.verificationPlace) errors.push({tab:'verification',field:'verificationPlace',msg:'Enter Place in the Verification tab.'});
  return errors;
}
function submitTRNPartB(){partBNext();}

function closeRegistrationPage(){
  document.body.classList.remove('registration-mode');
  location.reload();
}
function regSubmit(){let p=document.getElementById('rp').value.toUpperCase();if(!document.getElementById('rs').value||!document.getElementById('rn').value||!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(p)){document.getElementById('rr').innerHTML='<div class="f-error">Complete mandatory fields and enter a valid PAN format.</div>';return}let trn='TRN'+Date.now().toString().slice(-10);localStorage.gstTRN=trn;document.getElementById('rr').innerHTML='<div class="f-success">Part A accepted in demo. TRN: <b>'+trn+'</b>. Continue to Part B.</div>'}
function challan(){feature('Create Challan','Services > Payments',`<div class="feature-grid"><div class="f-card"><h3>Taxpayer</h3><label class="f-label">GSTIN</label><input class="f-input" id="cg" maxlength="15"><label class="f-label">Tax Period</label><select class="f-select"><option>Jul 2026</option><option>Jun 2026</option></select></div><div class="f-card"><h3>Amount</h3><label class="f-label">IGST</label><input class="f-input ca" type="number" value="0"><label class="f-label">CGST</label><input class="f-input ca" type="number" value="0"><label class="f-label">SGST / UTGST</label><input class="f-input ca" type="number" value="0"><label class="f-label">Cess</label><input class="f-input ca" type="number" value="0"><b>Total ₹ <span id="ct">0.00</span></b></div></div><button class="f-btn" onclick="makeChallan()">CREATE CHALLAN</button><div id="cr"></div>`);document.querySelectorAll('.ca').forEach(x=>x.oninput=()=>{let n=0;document.querySelectorAll('.ca').forEach(y=>n+=+y.value||0);ct.textContent=n.toFixed(2)})}
function makeChallan(){let g=cg.value.trim(),n=+ct.textContent;if(g.length!==15||!n){cr.innerHTML='<div class="f-error">Enter a 15-character GSTIN and amount.</div>';return}let c='CPIN'+Math.floor(1e9+Math.random()*9e9);localStorage.gstCPIN=c;cr.innerHTML='<div class="f-success">Challan created in demo. CPIN: <b>'+c+'</b> • Amount ₹'+n.toFixed(2)+'</div>'}
function paymentStatus(){feature('Track Payment Status','Services > Payments',`<div class="f-card"><h3>Search Payment</h3><label class="f-label">CPIN / CIN</label><input class="f-input" id="pc" placeholder="Enter CPIN"><button class="f-btn" onclick="pr()">SEARCH</button></div><div id="pres"></div>`)}
function pr(){pres.innerHTML='<div class="f-success">Payment record: <b>'+(pc.value||localStorage.gstCPIN||'CPIN-DEMO')+'</b> • Status: <span class="pill">Payment Initiated</span><br>Bank response: Awaiting confirmation (simulation).</div>'}
function track(t){let kind=t==='refund-status'?'Refund':t==='track-registration'?'Registration':t==='track-lut'?'LUT':t==='track-appeal'?'Appeal':'Application';feature('Track Application Status','Services > Track Application Status',`<div class="f-card"><h3>Track ${kind}</h3><label class="f-label">ARN / Reference Number</label><input class="f-input" id="tr" placeholder="Enter reference number"><label class="f-label">Filing Year</label><select class="f-select"><option>2026-27</option><option>2025-26</option></select><button class="f-btn" onclick="trackGo('${kind}')">SEARCH</button></div><div id="ts"></div>`)}
function trackGo(k){if(!tr.value){ts.innerHTML='<div class="f-error">Enter the reference number.</div>';return}ts.innerHTML='<div class="f-card"><h3>'+k+' Status</h3><p>Reference: <b>'+tr.value+'</b></p><div class="status-bar"><div class="status-step done">Filed</div><div class="status-step done">Acknowledged</div><div class="status-step current">Under Processing</div><div class="status-step">Order</div><div class="status-step">Completed</div></div></div>'}
function eway(t){if(t==='eway-generate')return feature('Generate E-Way Bill','e-Way Bill System',`<div class="feature-grid"><div class="f-card"><h3>Document</h3><label class="f-label">Document Type</label><select class="f-select"><option>Tax Invoice</option><option>Bill of Supply</option><option>Delivery Challan</option></select><label class="f-label">Document Number</label><input class="f-input" id="ed"><label class="f-label">Document Date</label><input class="f-input" type="date"></div><div class="f-card"><h3>Transport</h3><label class="f-label">Invoice Value</label><input class="f-input" id="ev" type="number"><label class="f-label">Mode</label><select class="f-select" id="em"><option>Road</option><option>Rail</option><option>Air</option><option>Ship</option></select><label class="f-label">Vehicle Number</label><input class="f-input" id="eveh"></div></div><button class="f-btn" onclick="eg()">GENERATE DEMO E-WAY BILL</button><div id="er"></div>`);feature(t==='eway-print'?'Print / Download E-Way Bill':t==='eway-update'?'Update Vehicle / Transporter':t==='eway-cancel'?'Cancel E-Way Bill':t==='eway-reject'?'Reject E-Way Bill':t==='eway-history'?'E-Way Bill History':t==='eway-validity'?'Check E-Way Bill Validity':'Search E-Way Bill','e-Way Bill System',`<div class="f-card"><label class="f-label">E-Way Bill Number</label><input class="f-input" id="en" placeholder="Enter demo EWB number"><button class="f-btn" onclick="ea('${t}')">CONTINUE</button></div><div id="eas"></div>`)}
function eg(){let n='EWB'+Math.floor(1e10+Math.random()*9e10);localStorage.gstEWB=n;er.innerHTML='<div class="f-success">Demo E-Way Bill generated: <b>'+n+'</b> • Status: Active • Mode: '+em.value+'</div>'}
function ea(t){let n=en.value||localStorage.gstEWB||'EWB-DEMO';eas.innerHTML='<div class="f-success"><b>'+n+'</b> — '+({ 'eway-print':'Print/download prepared','eway-update':'Vehicle update validated','eway-cancel':'Cancellation validated','eway-reject':'Rejection validated','eway-history':'History loaded','eway-validity':'Validity: Active','eway-search':'Search result loaded'}[t]||'Action completed')+' (simulation).</div>'}
function hsn(){feature('Search HSN Code','Services > User Services',`<div class="f-card"><label class="f-label">Code / Description</label><input class="f-input" id="hq" placeholder="e.g. garments, software, transport"><button class="f-btn" onclick="hs()">SEARCH</button></div><div id="hr"></div>`)}
function hs(){hr.innerHTML='<div class="f-card"><table class="result-table"><tr><th>Code</th><th>Description</th><th>Type</th></tr><tr><td>6109</td><td>T-shirts and vests</td><td>Goods</td></tr><tr><td>6203</td><td>Men’s suits and jackets</td><td>Goods</td></tr><tr><td>9983</td><td>Professional / technical services</td><td>Services</td></tr></table></div>'}
function gstp(){feature('Locate GST Practitioner (GSTP)','Services > User Services',`<div class="f-card"><label class="f-label">State</label><select class="f-select"><option>Kerala</option><option>Karnataka</option><option>Delhi</option></select><label class="f-label">District / PIN</label><input class="f-input"><button class="f-btn" onclick="notify('GST Practitioner results loaded')">SEARCH</button></div>`)}
function taxpayer(t){feature('Search Taxpayer','Search Taxpayer',`<div class="f-card"><label class="f-label">${t==='taxpayer-pan'?'PAN':t==='taxpayer-name'?'Name':'GSTIN / UIN'}</label><input class="f-input" id="tq"><button class="f-btn" onclick="tp()">SEARCH</button></div><div id="tpr"></div>`)}
function tp(){tpr.innerHTML='<div class="f-card"><table class="result-table"><tr><th>GSTIN/UIN</th><td>32ABCDE1234F1Z5</td></tr><tr><th>Legal Name</th><td>Demo Enterprises Private Limited</td></tr><tr><th>Trade Name</th><td>Demo Enterprises</td></tr><tr><th>Status</th><td><span class="pill">Active</span></td></tr><tr><th>Principal Place</th><td>Thiruvalla, Kerala</td></tr></table></div>'}
function refundApply(){feature('Refund Application — RFD-01','Services > Refunds',`<div class="feature-grid"><div class="f-card"><label class="f-label">Refund Category</label><select class="f-select"><option>Export without payment of tax</option><option>Inverted tax structure</option><option>Excess cash ledger balance</option></select><label class="f-label">Tax Period</label><input class="f-input" type="month"><label class="f-label">Amount Claimed</label><input class="f-input" type="number"></div><div class="f-card"><label class="f-label">Remarks</label><textarea class="f-textarea"></textarea><button class="f-btn green" onclick="notify('Refund draft submitted in demo')">SUBMIT DEMO</button></div></div>`)}
function ledger(){feature('Electronic Cash Ledger','Services > Ledgers',`<div class="feature-grid three"><div class="f-card"><h3>IGST</h3><b>₹12,500</b></div><div class="f-card"><h3>CGST</h3><b>₹9,000</b></div><div class="f-card"><h3>SGST / UTGST</h3><b>₹8,750</b></div></div><div class="f-note">Demo ledger only.</div>`)}
function invoice(){feature('e-Invoice Services','e-Invoice',`<div class="f-card"><label class="f-label">IRN / Invoice Reference</label><input class="f-input"><label class="f-label">GSTIN</label><input class="f-input"><button class="f-btn" onclick="notify('e-Invoice demo verification completed')">VERIFY</button></div>`)}
function grievance(){feature('Grievance Redressal','GST Services',`<div class="feature-grid"><div class="f-card"><label class="f-label">Reference</label><input class="f-input"><label class="f-label">Issue Type</label><select class="f-select"><option>Payment issue</option><option>Portal issue</option><option>Refund issue</option></select></div><div class="f-card"><label class="f-label">Description</label><textarea class="f-textarea"></textarea><button class="f-btn" onclick="notify('Demo grievance ticket created')">SUBMIT</button></div></div>`)}
function applications(){feature('My Applications','Services > User Services',`<table class="result-table"><tr><th>Application</th><th>Reference</th><th>Status</th></tr><tr><td>Registration</td><td>TRN-DEMO-2026</td><td>Pending for Validation</td></tr><tr><td>Refund</td><td>ARN-DEMO-2026</td><td>Under Processing</td></tr></table>`)}
function generic(t){let s=t.replaceAll('-',' ');feature(s,'GST Portal',`<div class="feature-grid"><div class="f-card"><h3>${s}</h3><p>This section is connected to the portal simulator. The UI, forms and navigation are functional locally.</p><button class="f-btn" onclick="notify('${s} opened')">OPEN</button></div><div class="f-card"><h3>Information</h3><p>Demo content area for forms, notifications, manuals, due dates and service information.</p></div></div>`)}

function notify(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.style.display='block';
  clearTimeout(window.toastTimer);
  window.toastTimer=setTimeout(()=>t.style.display='none',2200);
}
function legacyOpenModal(type){
  const bg=document.getElementById('modalBg');
  const title=document.getElementById('modalTitle');
  const body=document.getElementById('modalBody');
  if(type==='login'){
    title.textContent='Login';
    body.innerHTML=`
      <label>Username</label><input type="text" placeholder="Enter username">
      <label>Password</label><input type="password" placeholder="Enter password">
      <div class="modal-actions"><button class="primary" onclick="demoAction('Login')">LOGIN</button><button class="secondary" onclick="closeModal()">CLOSE</button></div>
      <div class="demo-note">UI demonstration only. No credentials are stored or transmitted.</div>`;
  } else if(type==='register'){
    title.textContent='Register';
    body.innerHTML=`
      <label>Registration Type</label><select><option>Taxpayer</option><option>GST Practitioner</option></select>
      <label>State / UT</label><select><option>Select State / UT</option><option>Kerala</option><option>Delhi</option><option>Maharashtra</option><option>Karnataka</option></select>
      <div class="modal-actions"><button class="primary" onclick="demoAction('Registration')">CONTINUE</button><button class="secondary" onclick="closeModal()">CLOSE</button></div>
      <div class="demo-note">UI demonstration only.</div>`;
  } else {
    title.textContent='Search Taxpayer';
    body.innerHTML=`
      <label>GSTIN / UIN</label><input id="gstin" maxlength="15" placeholder="Enter GSTIN / UIN">
      <label>Captcha</label><input id="captcha" placeholder="Type the characters shown">
      <div class="modal-actions"><button class="primary" onclick="searchTaxpayer()">SEARCH</button><button class="secondary" onclick="closeModal()">CLOSE</button></div>
      <div id="result" class="demo-note"></div>`;
  }
  bg.style.display='flex';
}
function closeModal(e){
  if(!e || e.target===document.getElementById('modalBg')) document.getElementById('modalBg').style.display='none';
}
function demoAction(name){
  closeModal();
  notify(name+' demo action');
}
function searchTaxpayer(){
  const g=document.getElementById('gstin').value.trim().toUpperCase();
  const r=document.getElementById('result');
  if(g.length!==15){r.textContent='Please enter a 15-character GSTIN for this demo.';return;}
  r.innerHTML='<strong>Demo result:</strong> taxpayer search UI is working. No live GSTN data is queried.';
}


(function forceDefaultPortalZoom(){
  try{
    document.documentElement.style.zoom='1';
    document.documentElement.style.setProperty('--gst-zoom','1');
    document.body.style.zoom='1';
  }catch(e){}
})();
document.addEventListener('DOMContentLoaded',()=>{
  try{
    document.documentElement.style.zoom='1';
    document.documentElement.style.setProperty('--gst-zoom','1');
    document.body.style.zoom='1';
    if(typeof bindPANInputs==='function') bindPANInputs();
    showResumeDraftBanner();
  }catch(e){}
});
window.gstShowLoader=function(msg){
  const el=document.getElementById('gstLoaderOverlay'); if(!el)return;
  const t=el.querySelector('.gst-loader-text'); if(t)t.textContent=msg||'Please wait...';
  el.classList.add('show');
};
window.gstHideLoader=function(){
  const el=document.getElementById('gstLoaderOverlay'); if(el)el.classList.remove('show');
};
// Random 2-4s delay used for most page/panel opens, so the app has a
// believable "government portal" loading feel instead of snapping
// instantly between screens. Login specifically uses a fixed 4s instead
// of this (see submitGSTFullLogin).
window.gstRandomDelay=function(){ return 2000+Math.random()*2000; };
// Runs `after` behind a brief spinner, matching the real portal's page-
// transition loading state instead of an instant snap between screens.
window.gstWithLoader=function(msg,after,delay){
  window.gstShowLoader(msg);
  setTimeout(()=>{ try{ after(); } finally { window.gstHideLoader(); } }, delay||window.gstRandomDelay());
};
function showResumeDraftBanner(){
  // If a registration draft (TRN) already exists, put a one-click way to jump
  // straight back into Part-B on the Home dashboard — no need to repeat
  // Part-A / OTP / TRN-login every time to get back to this screen.
  const trn=localStorage.getItem('gstTRN')||'';
  const app=JSON.parse(localStorage.getItem('gstRegistrationApplication')||'{}');
  if(!trn||!app.trn||app.trn!==trn) return;
  if(localStorage.getItem('gstLoggedIn')==='true') return; // already a full taxpayer, not mid-registration
  const contentEl=document.querySelector('.main > .content'); if(!contentEl) return;
  if(document.getElementById('resumeDraftBanner')) return;
  const banner=document.createElement('div');
  banner.id='resumeDraftBanner';
  banner.className='resume-draft-banner';
  banner.innerHTML=`<div>Draft registration in progress — <b>TRN: ${trn}</b></div><button onclick="openTRNPartB()">CONTINUE APPLICATION →</button>`;
  contentEl.parentNode.insertBefore(banner,contentEl);
}

let gstFontScale=0;
function setFontScale(direction){
  if(direction===0) gstFontScale=0;
  else gstFontScale=Math.max(-2,Math.min(3,gstFontScale+direction));
  const scale=1.25*(1+(gstFontScale*0.12));
  document.documentElement.style.setProperty('--gst-zoom',String(scale));
  document.documentElement.style.zoom=String(scale);
  document.body.dataset.fontScale=gstFontScale;
}

document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();closeFeature();closeOtpOverlay()}});

/* ===== LOGIN + TAXPAYER DASHBOARD + RETURNS DASHBOARD ===== */
const GST_DEMO={
  username:'demo.taxpayer',
  password:'Demo@123',
  gstin:'32ABCDE1234F1Z5',
  legalName:'Demo Enterprises Private Limited',
  tradeName:'Demo Enterprises',
  state:'Kerala',
  taxpayerType:'Regular',
  frequency:'Monthly',
  fy:'2026-27',
  period:'Jul 2026'
};
function gstRead(key, fallback){try{const v=localStorage.getItem(key);return v===null?fallback:JSON.parse(v)}catch(e){return fallback}}
function gstWrite(key,val){localStorage.setItem(key,JSON.stringify(val))}
function gstLoggedIn(){return localStorage.getItem('gstLoggedIn')==='1'}
function gstEnsureSession(){
  if(!localStorage.getItem('gstLoginTime')) localStorage.setItem('gstLoginTime',new Date().toISOString());
  gstWrite('gstTaxpayer',GST_DEMO);
}
function gstRequireLogin(target){if(!gstLoggedIn()){notify('Please login as taxpayer first');openModal('login');return false}return true}
function gstLoginCaptcha(){return String(Math.floor(1000+Math.random()*9000))}
function gstShowLoginOtp(){
  const bg=document.getElementById('modalBg'),title=document.getElementById('modalTitle'),body=document.getElementById('modalBody');
  title.textContent='Two-Factor Authentication';
  const otp=String(Math.floor(100000+Math.random()*900000));
  sessionStorage.setItem('gstLoginOtp',otp);
  body.innerHTML=`
    <div class="gst-login-section"><h4>OTP Verification</h4>
      <div class="gst-alert info">A simulated OTP has been sent to the registered mobile number for this training session.</div>
      <div class="gst-login-otp"><div class="gst-otp-box"><label>Mobile OTP</label><input id="gstLoginOtpInput" maxlength="6" inputmode="numeric" placeholder="Enter 6-digit OTP"></div><div class="gst-otp-box"><label>Demo OTP</label><input value="${otp}" readonly></div></div>
      <div class="modal-actions"><button class="primary" onclick="gstVerifyLoginOtp()">VERIFY & LOGIN</button><button class="secondary" onclick="closeModal()">CLOSE</button></div>
      <div class="gst-auth-note">Training simulator only. No real GST credentials or OTPs are transmitted.</div>
      <div id="gstLoginOtpMsg" class="demo-note"></div>
    </div>`;
  bg.style.display='flex';
}
function gstVerifyLoginOtp(){
  const input=document.getElementById('gstLoginOtpInput')?.value.trim();
  const expected=sessionStorage.getItem('gstLoginOtp');
  const msg=document.getElementById('gstLoginOtpMsg');
  if(input!==expected){msg.innerHTML='<span style="color:#9a2f2f">Invalid OTP. Enter the simulated OTP shown above.</span>';return}
  localStorage.setItem('gstLoggedIn','1');localStorage.setItem('gstLoginTime',new Date().toISOString());gstEnsureSession();closeModal();openTaxpayerDashboard();
}
function openTaxpayerDashboard(){
  if(!gstLoggedIn()){openModal('login');return}
  gstEnsureSession();
  feature('Taxpayer Dashboard','Dashboard',gstDashboardBody());
}
function gstDashboardBody(){
  const p=gstRead('gstTaxpayer',GST_DEMO);const apps=gstRead('gstApplications',[]);const notices=gstRead('gstNotices',[]);
  return `<div class="gst-dash-head"><h2>Taxpayer Dashboard</h2><div class="gst-dash-meta"><span>GSTIN: <b>${esc(p.gstin)}</b></span><span>Legal Name: <b>${esc(p.legalName)}</b></span><span>Trade Name: <b>${esc(p.tradeName)}</b></span><span>Status: <b>Active</b></span><span>Taxpayer Type: <b>${esc(p.taxpayerType)}</b></span></div></div>
  <div class="gst-alert info"><b>Welcome to the GST Portal.</b> Use Services &gt; Returns &gt; Returns Dashboard to prepare and file returns. This is an offline training simulation and is not connected to GSTN.</div>
  <div class="gst-summary-grid">
    <div class="gst-summary"><div class="label">Cash Balance</div><div class="value">₹25,250.00</div><div class="sub">Electronic Cash Ledger</div></div>
    <div class="gst-summary"><div class="label">ITC Balance</div><div class="value">₹42,800.00</div><div class="sub">Electronic Credit Ledger</div></div>
    <div class="gst-summary"><div class="label">Outstanding Liability</div><div class="value">₹18,450.00</div><div class="sub">Liability Register</div></div>
    <div class="gst-summary"><div class="label">Pending Returns</div><div class="value">2</div><div class="sub">Current FY</div></div>
  </div>
  <div class="gst-section-title">Return Filing Status — ${esc(p.fy)}</div>
  <table class="gst-table"><thead><tr><th>Return</th><th>Period</th><th>Due Date</th><th>Status</th><th>Action</th></tr></thead><tbody>
    <tr><td>GSTR-1</td><td>Jul 2026</td><td>11-Aug-2026</td><td><span class="gst-status orange">Not Filed</span></td><td><button class="gst-action" onclick="openReturnsDashboard()">PREPARE</button></td></tr>
    <tr><td>GSTR-3B</td><td>Jul 2026</td><td>20-Aug-2026</td><td><span class="gst-status orange">Not Filed</span></td><td><button class="gst-action" onclick="openReturnsDashboard()">PREPARE</button></td></tr>
    <tr><td>GSTR-1</td><td>Jun 2026</td><td>11-Jul-2026</td><td><span class="gst-status green">Filed</span></td><td><button class="gst-action secondary" onclick="notify('Filed return preview opened in simulator')">VIEW</button></td></tr>
  </tbody></table>
  <div class="gst-section-title">Quick Links</div>
  <div class="gst-tile-grid">
    <div class="gst-return-tile"><div class="rt-head">Returns Dashboard</div><div class="rt-body"><div class="rt-row"><span>Prepare returns</span><b>FY ${esc(p.fy)}</b></div><div class="rt-actions"><button class="gst-action" onclick="openReturnsDashboard()">OPEN</button></div></div></div>
    <div class="gst-return-tile"><div class="rt-head">Electronic Ledgers</div><div class="rt-body"><div class="rt-row"><span>Cash / Credit / Liability</span><b>View</b></div><div class="rt-actions"><button class="gst-action secondary" onclick="featureNav('Electronic Cash Ledger')">VIEW LEDGER</button></div></div></div>
    <div class="gst-return-tile"><div class="rt-head">My Applications</div><div class="rt-body"><div class="rt-row"><span>Applications</span><b>${apps.length||2}</b></div><div class="rt-actions"><button class="gst-action secondary" onclick="featureNav('My Applications')">VIEW</button></div></div></div>
    <div class="gst-return-tile"><div class="rt-head">Notices & Orders</div><div class="rt-body"><div class="rt-row"><span>Unread / pending</span><b>${notices.length||1}</b></div><div class="rt-actions"><button class="gst-action secondary" onclick="featureNav('Notices & Orders')">VIEW</button></div></div></div>
  </div><div style="margin-top:14px;text-align:right"><button class="gst-action secondary" onclick="gstLogout()">LOGOUT</button></div>`;
}
function openReturnsDashboard(){
  if(!gstRequireLogin('returns'))return;
  feature('Returns Dashboard','Services > Returns > Returns Dashboard',gstReturnsDashboardBody());
}
function gstReturnsDashboardBody(){
  const p=gstRead('gstTaxpayer',GST_DEMO);
  const isQuarterly=p.frequency==='Quarterly';
  return `<div class="gst-real-page gst-returns-dashboard">
    <div class="gst-real-breadcrumb"><span>Dashboard</span><i>›</i><b>Returns Dashboard</b></div>
    <div class="gst-real-title-row"><h2>File Returns</h2><span class="gst-mandatory-note"><b>*</b> Indicates Mandatory Fields</span></div>
    <div class="gst-real-help">To file your returns, select the Financial Year, Quarter and Period for which you want to file the return and click the SEARCH button.</div>
    <div class="gst-real-selector">
      <div class="gst-real-field"><label>Financial Year <em>*</em></label><select id="gstFY"><option>2026-27</option><option>2025-26</option><option>2024-25</option></select></div>
      <div class="gst-real-field"><label>Quarter <em>*</em></label><select id="gstQuarter" onchange="gstSyncQuarterPeriod()"><option value="Q1">Quarter 1 (Apr - Jun)</option><option value="Q2" selected>Quarter 2 (Jul - Sep)</option><option value="Q3">Quarter 3 (Oct - Dec)</option><option value="Q4">Quarter 4 (Jan - Mar)</option></select></div>
      <div class="gst-real-field"><label>Period <em>*</em></label><select id="gstPeriod"><option>Jul 2026</option><option>Aug 2026</option><option>Sep 2026</option></select></div>
      <button class="gst-real-search" onclick="gstSearchReturns()">SEARCH</button>
    </div>
    <div class="gst-real-message"><b>Important:</b> The return tiles shown below are based on the taxpayer profile, selected period and applicable return frequency. This training simulator uses simulated data.</div>
    <div id="gstReturnResults"><div class="gst-real-empty">Select the Financial Year, Quarter and Period, then click <b>SEARCH</b>.</div></div>
  </div>`;
}
function gstSyncQuarterPeriod(){
  const q=document.getElementById('gstQuarter');
  const p=document.getElementById('gstPeriod');
  if(!q||!p)return;
  const months={Q1:['Apr 2026','May 2026','Jun 2026'],Q2:['Jul 2026','Aug 2026','Sep 2026'],Q3:['Oct 2026','Nov 2026','Dec 2026'],Q4:['Jan 2027','Feb 2027','Mar 2027']};
  p.innerHTML=(months[q.value]||months.Q2).map((m,i)=>`<option>${m}</option>`).join('');
}
function gstSearchReturns(){
  const fy=document.getElementById('gstFY')?.value||'2026-27';
  const period=document.getElementById('gstPeriod')?.value||'Jul 2026';
  const quarter=document.getElementById('gstQuarter')?.value||'Q2';
  const p=gstRead('gstTaxpayer',GST_DEMO);
  const q=p.frequency==='Quarterly';
  const type=document.getElementById('gstReturnType')?.value||'All Returns';
  const month=period.split(' ')[0];
  const due1={Jan:'11-Feb-2027',Feb:'11-Mar-2027',Mar:'11-Apr-2027',Apr:'11-May-2026',May:'11-Jun-2026',Jun:'11-Jul-2026',Jul:'11-Aug-2026',Aug:'11-Sep-2026',Sep:'11-Oct-2026',Oct:'11-Nov-2026',Nov:'11-Dec-2026',Dec:'11-Jan-2027'}[month]||'As applicable';
  const due3={Jan:'20-Feb-2027',Feb:'20-Mar-2027',Mar:'20-Apr-2027',Apr:'20-May-2026',May:'20-Jun-2026',Jun:'20-Jul-2026',Jul:'20-Aug-2026',Aug:'20-Sep-2026',Sep:'20-Oct-2026',Oct:'20-Nov-2026',Nov:'20-Dec-2026',Dec:'20-Jan-2027'}[month]||'As applicable';
  const m1=['Apr','Jul','Oct','Jan'].includes(month), m2=['May','Aug','Nov','Feb'].includes(month);
  const iff=q&&(m1||m2);
  const tiles=[];
  tiles.push(['GSTR-1','Details of outward supplies of goods or services','GSTR-1',due1,period,'Not Filed','PREPARE ONLINE','PREPARE OFFLINE']);
  if(iff) tiles.push(['IFF','Invoice Furnishing Facility for QRMP taxpayers','IFF',due1,period,'Not Filed','PREPARE ONLINE','']);
  tiles.push(['GSTR-1A','Amendment facility for GSTR-1','GSTR-1A','As applicable',period,'Available','PREPARE ONLINE','']);
  tiles.push(['GSTR-2B','Auto-drafted ITC Statement (For view only)','GSTR-2B','As applicable',period,'Available','VIEW','DOWNLOAD']);
  tiles.push(['GSTR-3B','Monthly Return','GSTR-3B',due3,period,'Not Filed','PREPARE ONLINE','PREPARE OFFLINE']);
  if(!q) tiles.push(['GSTR-9','Annual Return','GSTR-9','31-Dec following FY',fy,'Not Filed','VIEW','']);
  if(!q) tiles.push(['GSTR-9C','Reconciliation Statement','GSTR-9C','As applicable',fy,'Not Filed','VIEW','']);
  const shown=type==='All Returns'?tiles:tiles.filter(x=>x[0]===type);
  const head=`<div class="gst-real-results-head"><b>Returns for ${esc(fy)} — ${esc(period)}</b><span>Taxpayer: ${esc(p.legalName||'Demo Taxpayer')}</span></div>`;
  const grid=shown.map(x=>gstRealReturnTile(x[0],x[1],x[2],x[3],x[4],x[5],x[6],x[7])).join('');
  document.getElementById('gstReturnResults').innerHTML=head+`<div class="gst-real-tile-grid">${grid||'<div class="gst-real-empty">No applicable return found for the selected criteria.</div>'}</div>`;
}
function gstRealReturnTile(name,desc,form,due,period,status,primary,secondary){
  const statusClass=status==='Filed'?'gst-real-green':status==='Available'?'gst-real-teal':'gst-real-orange';
  const primaryCall=`gstOpenReturn('${name}')`;
  const secondaryCall=name==='GSTR-2B'?`notify('GSTR-2B JSON download simulated')`:name==='GSTR-1'?`notify('GSTR-1 offline utility download simulated')`:`notify('${name} secondary action')`;
  return `<div class="gst-real-return-tile">
    <div class="gst-real-tile-head"><div>${esc(desc)}</div><small>${esc(form)}</small></div>
    <div class="gst-real-tile-body">
      <div class="gst-real-tile-due">Due Date : <b>${esc(due)}</b></div>
      <div class="gst-real-tile-status">Status : <span class="${statusClass}">${esc(status)}</span></div>
      <div class="gst-real-tile-actions">${primary?`<button onclick="${primaryCall}">${esc(primary)}</button>`:''}${secondary?`<button onclick="${secondaryCall}" class="secondary">${esc(secondary)}</button>`:''}</div>
    </div>
  </div>`;
}
function gstReturnTile(name,desc,due,period,status,action,onclick){
  return `<div class="gst-return-tile"><div class="rt-head">${name}</div><div class="rt-body"><div class="rt-row"><span>Description</span><b>${desc}</b></div><div class="rt-row"><span>Period</span><b>${period}</b></div><div class="rt-row"><span>Due Date</span><b>${due}</b></div><div class="rt-row"><span>Status</span><b><span class="gst-status ${status==='Filed'?'green':status==='Available'?'':'orange'}">${status}</span></b></div><div class="rt-actions"><button class="gst-action" onclick="${onclick}">${action}</button><button class="gst-action secondary" onclick="notify('${name} summary opened')">VIEW SUMMARY</button></div></div></div>`;
}
function gstOpenReturn(name){
  if(name==='GSTR-1') return feature('GSTR-1 — Details of Outward Supplies','Returns > Returns Dashboard > GSTR-1',`<div class="gst-alert info">GSTR-1 preparation starts from the selected return period. Records are saved locally in this training simulator and can later feed the simulated recipient-side workflow.</div><div class="gst-section-title">GSTR-1 Dashboard</div><table class="gst-table"><tr><th>Section</th><th>Description</th><th>Records</th><th>Action</th></tr><tr><td>B2B</td><td>Business to Business supplies</td><td>0</td><td><button class="gst-action" onclick="notify('B2B tile opened')">OPEN</button></td></tr><tr><td>B2C</td><td>Business to Consumer supplies</td><td>0</td><td><button class="gst-action" onclick="notify('B2C tile opened')">OPEN</button></td></tr><tr><td>Exports</td><td>Export invoices</td><td>0</td><td><button class="gst-action" onclick="notify('Exports tile opened')">OPEN</button></td></tr><tr><td>Credit/Debit Notes</td><td>Notes reported in the period</td><td>0</td><td><button class="gst-action" onclick="notify('Credit/Debit Notes tile opened')">OPEN</button></td></tr><tr><td>HSN/SAC</td><td>HSN/SAC summary</td><td>0</td><td><button class="gst-action" onclick="notify('HSN/SAC tile opened')">OPEN</button></td></tr></table><div class="gst-section-title">Actions</div><button class="gst-action" onclick="notify('GSTR-1 summary generated in simulator')">GENERATE SUMMARY</button> <button class="gst-action secondary" onclick="notify('GSTR-1 preview opened')">PREVIEW</button>`);
  return feature(name,'Returns > Returns Dashboard',`<div class="gst-alert info"><b>${name}</b> workspace opened from the Returns Dashboard. This phase establishes the correct portal navigation and return-selection workflow before the detailed return engine is connected.</div><div class="gst-section-title">Selected Return</div><table class="gst-table"><tr><th>Return</th><td>${name}</td></tr><tr><th>Financial Year</th><td>${esc(document.getElementById('gstFY')?.value||'2026-27')}</td></tr><tr><th>Return Period</th><td>${esc(document.getElementById('gstPeriod')?.value||'Jul 2026')}</td></tr><tr><th>Status</th><td><span class="gst-status orange">Not Filed</span></td></tr></table><div style="margin-top:12px"><button class="gst-action" onclick="notify('${name} preparation started')">PREPARE ONLINE</button> <button class="gst-action secondary" onclick="openReturnsDashboard()">BACK TO RETURNS DASHBOARD</button></div>`);
}
/* Replace the original generic sidebar click behavior with connected portal views. */
function featureNav(label){
  const map={
    'Dashboard':openTaxpayerDashboard,
    'Returns Dashboard':openReturnsDashboard,
    'My Applications':()=>applications(),
    'GSTR-1':()=>gstOpenReturn('GSTR-1'),
    'GSTR-1A':()=>gstOpenReturn('GSTR-1A'),
    'GSTR-3B':()=>gstOpenReturn('GSTR-3B'),
    'GSTR-9':()=>gstOpenReturn('GSTR-9'),
    'GSTR-9C':()=>gstOpenReturn('GSTR-9C'),
    'Electronic Cash Ledger':()=>ledger(),
    'Electronic Credit Ledger':()=>creditLedger(),
    'Electronic Liability Register':()=>liabilityRegister(),
    'Create Challan':()=>challan(),
    'Track Payment':()=>paymentStatus(),
    'Registration':()=>openFeature('new-registration'),
    'Refunds':()=>refundApply(),
    'LUT':()=>lut(),
    'e-Invoice':()=>invoice(),
    'e-Way Bill':()=>window.ewbDashboard?window.ewbDashboard():openFeature('eway-generate'),
    'Notices & Orders':()=>notices()
  };
  if(map[label]){
    if(label!=='Dashboard'&&label!=='Returns Dashboard'&&!gstRequireLogin(label))return;
    return map[label]();
  }
  notify(label+' selected');
}
/* Replace the original login modal while preserving the exact public header/button UI. */
function openModal(type){
  const bg=document.getElementById('modalBg'),title=document.getElementById('modalTitle'),body=document.getElementById('modalBody');
  if(type==='login'){
    title.textContent='Login';
    const captcha=gstLoginCaptcha();sessionStorage.setItem('gstLoginCaptcha',captcha);
    body.innerHTML=`<div class="gst-login-grid"><div class="gst-login-section"><h4>Taxpayer Login</h4><div class="gst-field"><label>Username</label><input id="gstLoginUser" autocomplete="off" placeholder="Enter username"></div><div class="gst-field"><label>Password</label><input id="gstLoginPass" type="password" autocomplete="off" placeholder="Enter password"></div><div class="gst-field"><label>Captcha</label><div class="gst-captcha"><span class="gst-captcha-code">${captcha}</span><input id="gstLoginCaptchaInput" maxlength="4" placeholder="Enter captcha"></div></div></div><div class="gst-login-section"><h4>Training Login</h4><div class="gst-alert info"><b>Demo taxpayer</b><br>Username: demo.taxpayer<br>Password: Demo@123</div><div class="gst-auth-note">Use only the supplied demo credentials. This simulator never sends credentials to GSTN and does not perform a real government login.</div></div></div><div class="modal-actions"><button class="primary" onclick="gstSubmitLogin()">LOGIN</button><button class="secondary" onclick="closeModal()">CLOSE</button></div><div id="gstLoginMsg" class="demo-note"></div>`;
  } else if(type==='register'){
    title.textContent='Register';body.innerHTML=`<label>Registration Type</label><select><option>Taxpayer</option><option>GST Practitioner</option></select><label>State / UT</label><select><option>Select State / UT</option><option>Kerala</option><option>Delhi</option><option>Maharashtra</option><option>Karnataka</option></select><div class="modal-actions"><button class="primary" onclick="demoAction('Registration')">CONTINUE</button><button class="secondary" onclick="closeModal()">CLOSE</button></div><div class="demo-note">UI demonstration only.</div>`;
  } else {
    title.textContent='Search Taxpayer';body.innerHTML=`<label>GSTIN / UIN</label><input id="gstin" maxlength="15" placeholder="Enter GSTIN / UIN"><label>Captcha</label><input id="captcha" placeholder="Type the characters shown"><div class="modal-actions"><button class="primary" onclick="searchTaxpayer()">SEARCH</button><button class="secondary" onclick="closeModal()">CLOSE</button></div><div id="result" class="demo-note"></div>`;
  }
  bg.style.display='flex';
}
function gstSubmitLogin(){
  const u=document.getElementById('gstLoginUser')?.value.trim();const p=document.getElementById('gstLoginPass')?.value;const c=document.getElementById('gstLoginCaptchaInput')?.value.trim();const expected=sessionStorage.getItem('gstLoginCaptcha');const msg=document.getElementById('gstLoginMsg');
  if(!u||!p||!c){msg.innerHTML='<span style="color:#9a2f2f">Please enter Username, Password and Captcha.</span>';return}
  if(c!==expected){msg.innerHTML='<span style="color:#9a2f2f">Captcha does not match.</span>';return}
  if(u!==GST_DEMO.username||p!==GST_DEMO.password){msg.innerHTML='<span style="color:#9a2f2f">Invalid demo credentials. Use the training credentials shown on the right.</span>';return}
  /* Current taxpayer login sequence: valid User ID + Password + Captcha -> Dashboard. OTP is used for specific transactions/filing flows, not as a generic login step in the GST user-guide flow. */
  localStorage.setItem('gstLoggedIn','1');localStorage.setItem('gstLoginTime',new Date().toISOString());gstEnsureSession();closeModal();openTaxpayerDashboard();
}
/* Logout is intentionally a portal state transition, not a page reload. */
function gstLogout(){localStorage.removeItem('gstLoggedIn');localStorage.removeItem('gstLoginTime');notify('You have been logged out');location.reload();}

/* ===== GSTR-1 REALISTIC TRAINING WORKSPACE ===== */
function gstReturnContext(){
  return {fy:document.getElementById('gstFY')?.value||localStorage.getItem('gstReturnFY')||'2026-27',period:document.getElementById('gstPeriod')?.value||localStorage.getItem('gstReturnPeriod')||'Jul 2026'};
}
function gstGstr1Key(){const c=gstReturnContext();return 'gstGstr1_'+c.fy+'_'+c.period.replace(/[^A-Za-z0-9]/g,'_')}
function gstGstr1Data(){return gstRead(gstGstr1Key(),{status:'Draft',invoices:[],notes:[],exports:[],b2c:[],hsn:[],documents:[],savedAt:null,submittedAt:null})}
function gstSaveGstr1(d){gstWrite(gstGstr1Key(),d)}
function gstMoney(n){return '₹'+(Number(n)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}
function gstTaxCalc(taxable,rate,pos){const t=Number(taxable)||0,r=Number(rate)||0,tot=t*r/100; if(pos==='Inter-State') return {igst:tot,cgst:0,sgst:0}; return {igst:0,cgst:tot/2,sgst:tot/2}}
function gstGstr1Summary(d){
  const inv=[...(d.invoices||[]),...(d.exports||[]),...(d.b2c||[])];
  return inv.reduce((a,x)=>{a.count++;a.taxable+=+x.taxable||0;a.igst+=+x.igst||0;a.cgst+=+x.cgst||0;a.sgst+=+x.sgst||0;return a},{count:0,taxable:0,igst:0,cgst:0,sgst:0});
}
function gstGstr1StatusClass(st){return st==='Filed'?'green':st==='Submitted'?'blue':st==='Validated'?'green':'orange'}
function gstOpenGstr1(){
  if(!gstRequireLogin('GSTR-1'))return;
  const c=gstReturnContext();localStorage.setItem('gstReturnFY',c.fy);localStorage.setItem('gstReturnPeriod',c.period);
  feature('GSTR-1 — Details of Outward Supplies','Services > Returns > Returns Dashboard > GSTR-1',gstGstr1Body());
}
function gstGstr1Body(){
  const c=gstReturnContext(),d=gstGstr1Data(),s=gstGstr1Summary(d);
  const tiles=[
    ['B2B','B2B Invoices / Debit Notes / Credit Notes','gstGstr1B2B()'],
    ['B2C LARGE','Inter-State B2C supplies above applicable threshold','gstGstr1B2C()'],
    ['B2C OTHERS','Other B2C outward supplies','gstGstr1B2C()'],
    ['EXPORTS','Export invoices / supplies','gstGstr1Exports()'],
    ['SEZ','Supplies to SEZ units / developers','gstGstr1B2B()'],
    ['DEEMED EXPORTS','Deemed export supplies','gstGstr1B2B()'],
    ['AMENDMENTS','Amended previously reported records','gstGstr1B2B()'],
    ['ADVANCES','Advances received / adjustment','gstGstr1B2C()'],
    ['HSN/SAC','HSN/SAC summary','gstGstr1Hsn()'],
    ['DOCUMENTS ISSUED','Document series and issued documents','gstGstr1Documents()'],
    ['NIL / EXEMPT / NON-GST','Nil-rated, exempt and non-GST outward supplies','gstGstr1B2C()']
  ];
  return `<div class="gst-dash-head"><h2>GSTR-1 — Details of Outward Supplies</h2><div class="gst-dash-meta"><span>Financial Year: <b>${esc(c.fy)}</b></span><span>Return Period: <b>${esc(c.period)}</b></span><span>GSTIN: <b>${esc(gstRead('gstTaxpayer',GST_DEMO).gstin)}</b></span><span>Status: <b>${esc(d.status)}</b></span></div></div>
  <div class="gst-alert info"><b>GSTR-1 preparation</b><br>Enter/save the applicable outward-supply details in the tiles below. The simulator keeps the selected period data locally and uses it for the subsequent training workflow.</div>
  <div class="gst-section-title">Return Preparation Status</div>
  <div class="gst-summary-grid"><div class="gst-summary"><div class="label">Documents</div><div class="value">${s.count}</div><div class="sub">Saved in current period</div></div><div class="gst-summary"><div class="label">Taxable Value</div><div class="value">${gstMoney(s.taxable)}</div><div class="sub">Outward supplies</div></div><div class="gst-summary"><div class="label">IGST</div><div class="value">${gstMoney(s.igst)}</div><div class="sub">Calculated tax</div></div><div class="gst-summary"><div class="label">CGST + SGST</div><div class="value">${gstMoney(s.cgst+s.sgst)}</div><div class="sub">Calculated tax</div></div></div>
  <div class="gst-section-title">GSTR-1 Tables / Tiles</div><div class="gst-tile-grid">${tiles.map(t=>{const count=(t[0]==='B2B'?d.invoices.length:t[0]==='EXPORTS'?d.exports.length:t[0].startsWith('B2C')?d.b2c.length:t[0]==='HSN/SAC'?d.hsn.length:t[0]==='DOCUMENTS ISSUED'?d.documents.length:0);return `<div class="gst-return-tile"><div class="rt-head">${t[0]}</div><div class="rt-body"><div class="rt-row"><span>Records</span><b>${count}</b></div><div class="rt-row"><span>Action</span><b>Prepare Online</b></div><div class="rt-actions"><button class="gst-action" onclick="${t[2]}">OPEN</button></div></div></div>`}).join('')}</div>
  <div class="gst-section-title">Return Actions</div>
  <div class="gst-alert warning">Before submission, save all applicable tiles and review the generated summary. Submission freezes the return data for the selected period in this training simulator.</div>
  <div class="gst-action-row"><button class="gst-action" onclick="gstGstr1GenerateSummary()">GENERATE GSTR-1 SUMMARY</button><button class="gst-action secondary" onclick="gstGstr1Preview()">PREVIEW GSTR-1</button><button class="gst-action" onclick="gstGstr1Validate()">VALIDATE</button><button class="gst-action" onclick="gstGstr1Submit()">SUBMIT</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK</button></div>
  <div id="gstGstr1Msg" class="demo-note"></div>`;
}
function gstGstr1B2B(){
  const d=gstGstr1Data();
  const grouped={};
  (d.invoices||[]).forEach((x,i)=>{const g=(x.recipientGstin||'').toUpperCase()||'UNKNOWN';if(!grouped[g])grouped[g]={gstin:g,name:x.recipientName||'Recipient Taxpayer',type:x.recipientType||'Regular',processed:0,pending:0,errored:0,total:0,indices:[]};grouped[g].total++;grouped[g].indices.push(i);if(x.status==='Pending')grouped[g].pending++;else if(x.status==='Errored')grouped[g].errored++;else grouped[g].processed++});
  const q=document.getElementById('g1bSearch')?.value?.trim().toUpperCase()||'';
  const groups=Object.values(grouped).filter(g=>!q||g.gstin.includes(q)||g.name.toUpperCase().includes(q));
  const rows=groups.map((g,idx)=>`<tr><td>${esc(g.gstin)}</td><td>${esc(g.name)}</td><td>${esc(g.type)}</td><td><a href="#" onclick="event.preventDefault();gstGstr1B2BDocuments('${esc(g.gstin)}')">${g.processed}</a></td><td>${g.pending||0}</td><td>${g.errored||0}</td><td><button class="gst-icon-btn" title="Add Invoice" onclick="gstGstr1B2BAdd('${esc(g.gstin)}')">+</button></td></tr>`).join('')||'<tr><td colspan="7" class="empty-state">No recipient records found.</td></tr>';
  feature('GSTR-1 — B2B Invoices','Services > Returns > GSTR-1 > ADD RECORD DETAILS > B2B',`<div class="gst-pagebar"><div><b>4A, 4B, 4C, 6B, 6C — B2B Invoices</b><div class="muted">Taxable outward supplies made to registered persons</div></div><button class="gst-action secondary" onclick="gstOpenGstr1()">BACK</button></div>
  <div class="gst-alert info"><b>B2B Invoices — Recipient-wise Summary</b><br>Records are grouped recipient-wise. Processed, pending and errored counts can be opened from this summary.</div>
  <div class="gst-toolbar"><div class="gst-search"><label>Search</label><input id="g1bSearch" class="f-input" placeholder="Search GSTIN / Legal Name" value="${esc(q)}"><button class="gst-action" onclick="gstGstr1B2B()">SEARCH</button></div><div class="gst-toolbar-right"><button class="gst-action secondary" onclick="gstGstr1B2BAdd('')">ADD INVOICE</button><button class="gst-action secondary" onclick="gstGstr1ImportEInvoices()">DOWNLOAD DETAILS FROM E-INVOICES</button><label>Records per page <select class="f-select"><option>10</option><option>25</option><option>50</option></select></label></div></div>
  <div class="gst-section-title">Recipient-wise Summary</div>
  <table class="gst-table gst-portal-table"><thead><tr><th>Recipient GSTIN</th><th>Recipient Name</th><th>Taxpayer Type</th><th>Processed Invoice</th><th>Pending Invoice</th><th>Errored Invoice</th><th>Add Invoice</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="gst-section-title">Training Note</div><div class="gst-alert info">Click <b>+</b> to open the Add Invoice screen with the recipient GSTIN pre-filled. After SAVE, the Add Invoice screen reopens so multiple invoices can be entered for the same recipient.</div>`);
}
function gstGstr1ImportEInvoices(){
  const d=gstGstr1Data();
  if(d.status!=='Draft'&&d.status!=='Validated'){notify('This return is frozen after submission — e-Invoice import is not available.');return}
  const eiState=gstRead('gstEInvoiceState_v3',{invoices:[]});
  const c=gstReturnContext();
  const periodDate=new Date(c.period+' 01');
  const gstinRe=/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;
  d.importedEInvoiceIRNs=d.importedEInvoiceIRNs||[];
  const alreadyImported=new Set(d.importedEInvoiceIRNs);
  const candidates=(eiState.invoices||[]).filter(inv=>{
    if(inv.status!=='Active')return false;
    if(alreadyImported.has(inv.irn))return false;
    if(!inv.buyerGSTIN||!gstinRe.test((inv.buyerGSTIN||'').toUpperCase()))return false; // B2B only — unregistered buyers go through B2C, not this import
    const dd=new Date(inv.docDate);
    return dd.getFullYear()===periodDate.getFullYear() && dd.getMonth()===periodDate.getMonth();
  });
  if(!candidates.length){
    feature('GSTR-1 — Import from e-Invoices','Services > Returns > GSTR-1 > B2B > Download Details from e-Invoices',`<div class="gst-alert info">No new, active, B2B e-Invoices were found for <b>${esc(c.period)}</b> that haven't already been imported into this GSTR-1.</div><div class="gst-action-row"><button class="gst-action secondary" onclick="gstGstr1B2B()">BACK TO B2B</button><button class="gst-action secondary" onclick="eiDashboard()">GO TO E-INVOICE</button></div>`);
    return;
  }
  let imported=0,skippedDup=0;
  candidates.forEach(inv=>{
    if(d.invoices.some(x=>x.invoiceNo.toUpperCase()===String(inv.docNo).toUpperCase()&&x.recipientGstin===(inv.buyerGSTIN||'').toUpperCase())){skippedDup++;d.importedEInvoiceIRNs.push(inv.irn);return}
    d.invoices.push({
      invoiceNo:inv.docNo,invoiceDate:inv.docDate,invoiceValue:+inv.total||0,
      recipientGstin:(inv.buyerGSTIN||'').toUpperCase(),recipientName:inv.buyerName||'Recipient Taxpayer',recipientType:'Regular',
      pos:(+inv.igst>0)?'Inter-State':'Kerala',rate:0,taxable:+inv.taxable||0,
      igst:+inv.igst||0,cgst:+inv.cgst||0,sgst:+inv.sgst||0,cess:+inv.cess||0,
      rcm:'No',invoiceType:'Regular B2B',ecomGstin:'',hsn:inv.hsn||'',status:'Processed',
      savedAt:new Date().toISOString(),fromEInvoice:true,irn:inv.irn
    });
    d.importedEInvoiceIRNs.push(inv.irn);
    imported++;
  });
  d.savedAt=new Date().toISOString();gstSaveGstr1(d);
  feature('GSTR-1 — Import from e-Invoices','Services > Returns > GSTR-1 > B2B > Download Details from e-Invoices',`<div class="gst-alert success"><b>${imported} e-Invoice${imported===1?'':'s'} imported</b> into B2B Table 4A for ${esc(c.period)}.${skippedDup?` (${skippedDup} skipped as already present with the same invoice number/recipient.)`:''}</div><table class="gst-table"><thead><tr><th>IRN</th><th>Invoice No.</th><th>Recipient GSTIN</th><th>Taxable</th><th>Tax</th></tr></thead><tbody>${candidates.map(inv=>`<tr><td style="word-break:break-all">${esc(String(inv.irn).slice(0,18))}…</td><td>${esc(inv.docNo)}</td><td>${esc(inv.buyerGSTIN)}</td><td>${gstMoney(inv.taxable)}</td><td>${gstMoney((+inv.igst||0)+(+inv.cgst||0)+(+inv.sgst||0))}</td></tr>`).join('')}</tbody></table><div class="gst-action-row"><button class="gst-action" onclick="gstGstr1B2B()">BACK TO B2B</button></div><div class="demo-note">Training simulator: pulls Active, B2B e-Invoices generated in the e-Invoice module whose document date falls in this return period, and skips ones already imported.</div>`);
}
function gstGstr1B2BAdd(recipient=''){
  const d=gstGstr1Data();
  if(d.status==='Submitted'||d.status==='Filed'){feature('GSTR-1 — B2B Add Invoice','GSTR-1 > B2B > Add Invoice',`<div class="gst-alert error">This return is frozen after submission.</div><button class="gst-action secondary" onclick="gstGstr1B2B()">BACK</button>`);return;}
  const pre=(recipient||'').toUpperCase();
  feature('GSTR-1 — B2B Add Invoice','GSTR-1 > B2B > Recipient-wise Summary > Add Invoice',`<div class="gst-pagebar"><div><b>B2B — Add Invoice</b><div class="muted">Taxable outward supply to a registered recipient</div></div><button class="gst-action secondary" onclick="gstGstr1B2B()">BACK</button></div>
  <div class="gst-alert info">Enter invoice details. Tax amounts are calculated from taxable value and tax rate. The CESS amount is entered separately.</div>
  <div class="gst-section-title">Invoice Details</div>
  <div class="gst-form-grid">
    <div><label>Recipient GSTIN *</label><input id="g1rGstin" class="f-input" maxlength="15" value="${esc(pre)}" placeholder="32ABCDE1234F1Z5"></div>
    <div><label>Recipient Name</label><input id="g1rRecipientName" class="f-input" placeholder="Auto-populated training value"></div>
    <div><label>Invoice Number *</label><input id="g1rInv" class="f-input" maxlength="16"></div>
    <div><label>Invoice Date *</label><input id="g1rDate" class="f-input" type="date"></div>
    <div><label>Total Invoice Value *</label><input id="g1rInvoiceValue" class="f-input" type="number" min="0" step="0.01"></div>
    <div><label>Place of Supply *</label><select id="g1rPos" class="f-select"><option value="Kerala">Kerala</option><option value="Inter-State">Inter-State</option></select></div>
    <div><label>Reverse Charge</label><select id="g1rRCM" class="f-select"><option>No</option><option>Yes</option></select></div>
    <div><label>Invoice Type</label><select id="g1rType" class="f-select"><option>Regular</option><option>SEZ supplies with payment</option><option>SEZ supplies without payment</option><option>Deemed Export</option></select></div>
    <div><label>E-Commerce GSTIN (if applicable)</label><input id="g1rEcom" class="f-input" maxlength="15"></div>
  </div>
  <div class="gst-section-title">Item / Tax Details</div>
  <div class="gst-form-grid">
    <div><label>HSN/SAC *</label><input id="g1rHsn" class="f-input" maxlength="8" placeholder="HSN/SAC"></div>
    <div><label>Tax Rate *</label><select id="g1rRate" class="f-select"><option>0</option><option>5</option><option selected>18</option><option>40</option></select></div>
    <div><label>Taxable Value *</label><input id="g1rTaxable" class="f-input" type="number" min="0" step="0.01" oninput="gstPreviewB2BTax()"></div>
    <div><label>Cess</label><input id="g1rCess" class="f-input" type="number" min="0" step="0.01" value="0" oninput="gstPreviewB2BTax()"></div>
  </div>
  <div class="gst-tax-preview" id="gstB2BTaxPreview"><div><span>IGST</span><b id="g1pIgst">₹0.00</b></div><div><span>CGST</span><b id="g1pCgst">₹0.00</b></div><div><span>SGST/UTGST</span><b id="g1pSgst">₹0.00</b></div><div><span>CESS</span><b id="g1pCess">₹0.00</b></div></div>
  <div class="gst-action-row"><button class="gst-action" onclick="gstAddGstr1B2B(true)">SAVE</button><button class="gst-action secondary" onclick="gstGstr1B2B()">BACK</button></div><div id="gstB2BMsg" class="demo-note"></div>`);
  gstPreviewB2BTax();
}
function gstPreviewB2BTax(){const taxable=+document.getElementById('g1rTaxable')?.value||0,rate=+document.getElementById('g1rRate')?.value||0,pos=document.getElementById('g1rPos')?.value||'';const t=gstTaxCalc(taxable,rate,pos==='Inter-State'?'Inter-State':'Intra-State');const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=gstMoney(v)};set('g1pIgst',t.igst);set('g1pCgst',t.cgst);set('g1pSgst',t.sgst);set('g1pCess',+document.getElementById('g1rCess')?.value||0)}
function gstAddGstr1B2B(reopen=false){
  const ids=['g1rGstin','g1rRecipientName','g1rInv','g1rDate','g1rInvoiceValue','g1rPos','g1rRCM','g1rType','g1rEcom','g1rHsn','g1rRate','g1rTaxable','g1rCess'];const v=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)?.value?.trim()||'']));const m=document.getElementById('gstB2BMsg');
  const gstin=v.g1rGstin.toUpperCase();if(!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(gstin)&&gstin!=='32ABCDE1234F1Z5'){m.innerHTML='<span style="color:#9a2f2f">Enter a valid recipient GSTIN.</span>';return}
  if(!v.g1rInv||!v.g1rDate||+v.g1rInvoiceValue<=0||!v.g1rHsn||+v.g1rTaxable<=0){m.innerHTML='<span style="color:#9a2f2f">Complete all mandatory invoice and tax fields.</span>';return}
  const d=gstGstr1Data();if(d.status!=='Draft'&&d.status!=='Validated'){m.innerHTML='<span style="color:#9a2f2f">This return is frozen after submission.</span>';return}
  if(d.invoices.some(x=>x.invoiceNo.toUpperCase()===v.g1rInv.toUpperCase()&&x.recipientGstin===gstin)){m.innerHTML='<span style="color:#9a2f2f">Duplicate invoice number detected for this recipient in this return period.</span>';return}
  const t=gstTaxCalc(v.g1rTaxable,+v.g1rRate,v.g1rPos==='Inter-State'?'Inter-State':'Intra-State');const item={invoiceNo:v.g1rInv,invoiceDate:v.g1rDate,invoiceValue:+v.g1rInvoiceValue,recipientGstin:gstin,recipientName:v.g1rRecipientName||'Recipient Taxpayer',recipientType:'Regular',pos:v.g1rPos,rate:+v.g1rRate,taxable:+v.g1rTaxable,igst:t.igst,cgst:t.cgst,sgst:t.sgst,cess:+v.g1rCess||0,rcm:v.g1rRCM,invoiceType:v.g1rType,ecomGstin:v.g1rEcom||'',hsn:v.g1rHsn,status:'Processed',savedAt:new Date().toISOString()};d.invoices.push(item);d.savedAt=new Date().toISOString();gstSaveGstr1(d);
  if(reopen){gstGstr1B2BAdd(gstin);const box=document.getElementById('gstB2BMsg');if(box)box.innerHTML='<span style="color:#176b35"><b>Request accepted successfully.</b> Invoice saved. You can continue adding invoices for this recipient.</span>';}else gstGstr1B2B();
}
function gstGstr1B2BDocuments(gstin){const d=gstGstr1Data();const arr=d.invoices.map((x,i)=>({...x,_i:i})).filter(x=>x.recipientGstin===gstin);const rows=arr.map(x=>`<tr><td>${esc(x.invoiceNo)}</td><td>${esc(x.invoiceDate)}</td><td>${gstMoney(x.invoiceValue)}</td><td>${esc(x.pos)}</td><td>${gstMoney(x.taxable)}</td><td>${gstMoney((+x.igst||0)+(+x.cgst||0)+(+x.sgst||0)+(+x.cess||0))}</td><td><button class="gst-action secondary" onclick="gstDeleteGstr1Invoice(${x._i})">DELETE</button></td></tr>`).join('')||'<tr><td colspan="7">No documents.</td></tr>';feature('GSTR-1 — B2B Document Details','GSTR-1 > B2B > Document Details',`<div class="gst-pagebar"><div><b>Document Details</b><div class="muted">Recipient GSTIN: ${esc(gstin)}</div></div><button class="gst-action" onclick="gstGstr1B2BAdd('${esc(gstin)}')">ADD INVOICE</button></div><div class="gst-toolbar"><div class="gst-search"><label>Search</label><input class="f-input" placeholder="Invoice number / date"></div></div><table class="gst-table"><thead><tr><th>Invoice No.</th><th>Invoice Date</th><th>Total Invoice Value</th><th>POS</th><th>Taxable Value</th><th>Total Tax</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table><div class="gst-action-row"><button class="gst-action secondary" onclick="gstGstr1B2B()">BACK</button></div>`)}
function gstDeleteGstr1Invoice(i){const d=gstGstr1Data();if(d.status!=='Draft'&&d.status!=='Validated'){notify('Submitted return records cannot be deleted');return}d.invoices.splice(i,1);gstSaveGstr1(d);gstGstr1B2B()}
function gstGstr1B2C(){
  const d=gstGstr1Data();
  const large=(d.b2c||[]).filter(x=>x.type==='B2C Large');
  const others=(d.b2c||[]).filter(x=>x.type==='B2C Others');
  const nil=(d.b2c||[]).filter(x=>x.type==='Nil / Exempt / Non-GST');
  const row=(x,i)=>`<tr><td>${esc(x.invoiceNo)}</td><td>${esc(x.date)}</td><td>${esc(x.pos)}</td><td>${gstMoney(x.invoiceValue||x.taxable)}</td><td>${gstMoney(x.taxable)}</td><td>${gstMoney((+x.igst||0)+(+x.cgst||0)+(+x.sgst||0))}</td><td><button class="gst-action secondary" onclick="gstDeleteGstr1B2C(${i})">DELETE</button></td></tr>`;
  const section=(title,items,button)=>`<div class="gst-section-title">${title}<button class="gst-action" style="float:right" onclick="${button}">ADD RECORD</button></div><table class="gst-table gst-portal-table"><thead><tr><th>Invoice / Reference No.</th><th>Date</th><th>Place of Supply</th><th>Invoice Value</th><th>Taxable Value</th><th>Total Tax</th><th>Action</th></tr></thead><tbody>${items.map(x=>row(x,d.b2c.indexOf(x))).join('')||'<tr><td colspan="7" class="empty-state">No records.</td></tr>'}</tbody></table>`;
  feature('GSTR-1 — B2C Supplies','Services > Returns > GSTR-1 > ADD RECORD DETAILS > B2C',`<div class="gst-pagebar"><div><b>5A, 5B / 7 — B2C Supplies</b><div class="muted">Outward supplies made to unregistered persons</div></div><button class="gst-action secondary" onclick="gstOpenGstr1()">BACK</button></div>
  <div class="gst-alert info"><b>B2C Large</b> is used for applicable inter-State consumer invoices above the current reporting threshold; <b>B2C Others</b> is reported in the applicable state/rate summary structure. This simulator keeps the workflow and validation training-oriented.</div>
  <div class="gst-page-tabs"><button class="gst-tab active">B2C LARGE</button><button class="gst-tab">B2C OTHERS</button><button class="gst-tab">NIL / EXEMPT / NON-GST</button></div>
  ${section('B2C Large — 5A, 5B',large,"gstGstr1B2CLargeAdd()")}
  ${section('B2C Others — Table 7',others,"gstGstr1B2COthersAdd()")}
  ${section('Nil / Exempt / Non-GST — Table 8',nil,"gstGstr1B2CNilAdd()")}
  <div class="gst-action-row"><button class="gst-action secondary" onclick="gstOpenGstr1()">BACK TO GSTR-1</button></div>`);
}
function gstGstr1B2CLargeAdd(){gstGstr1B2CAddForm('B2C Large','GSTR-1 > B2C Large > Add Record')}
function gstGstr1B2COthersAdd(){gstGstr1B2CAddForm('B2C Others','GSTR-1 > B2C Others > Add Record')}
function gstGstr1B2CNilAdd(){gstGstr1B2CAddForm('Nil / Exempt / Non-GST','GSTR-1 > Table 8 > Add Record')}
function gstGstr1B2CAddForm(type,crumb){
  const d=gstGstr1Data();
  feature('GSTR-1 — '+type,'Services > Returns > '+crumb,`<div class="gst-pagebar"><div><b>${esc(type)} — Add Record</b><div class="muted">${esc(crumb)}</div></div><button class="gst-action secondary" onclick="gstGstr1B2C()">BACK</button></div>
  <div class="gst-alert info">Enter the record details and save. Tax is calculated from taxable value and rate where applicable.</div>
  <div class="gst-section-title">Supply Details</div>
  <div class="gst-form-grid">
    <div><label>Invoice / Reference No. *</label><input id="g1bInv" class="f-input" maxlength="16"></div>
    <div><label>Invoice / Document Date *</label><input id="g1bDate" type="date" class="f-input"></div>
    <div><label>Place of Supply *</label><select id="g1bPos" class="f-select"><option>Kerala</option><option>Tamil Nadu</option><option>Karnataka</option><option>Maharashtra</option><option>Other State</option></select></div>
    <div><label>Invoice Value *</label><input id="g1bInvoiceValue" type="number" min="0" step="0.01" class="f-input"></div>
    <div><label>Taxable Value *</label><input id="g1bTaxable" type="number" min="0" step="0.01" class="f-input" oninput="gstPreviewB2CTax()"></div>
    <div><label>Tax Rate *</label><select id="g1bRate" class="f-select" onchange="gstPreviewB2CTax()"><option>0</option><option>5</option><option selected>18</option><option>40</option></select></div>
    <div><label>CESS</label><input id="g1bCess" type="number" min="0" step="0.01" value="0" class="f-input" oninput="gstPreviewB2CTax()"></div>
    <div><label>Nature of Supply</label><select id="g1bNature" class="f-select"><option>Taxable</option><option>Nil Rated</option><option>Exempt</option><option>Non-GST</option></select></div>
  </div>
  <div class="gst-tax-preview"><div><span>IGST</span><b id="g1bpIgst">₹0.00</b></div><div><span>CGST</span><b id="g1bpCgst">₹0.00</b></div><div><span>SGST/UTGST</span><b id="g1bpSgst">₹0.00</b></div><div><span>CESS</span><b id="g1bpCess">₹0.00</b></div></div>
  <div class="gst-action-row"><button class="gst-action" onclick="gstAddGstr1B2C('${esc(type)}')">SAVE</button><button class="gst-action secondary" onclick="gstGstr1B2C()">BACK</button></div><div id="gstB2CMsg" class="demo-note"></div>`);
  gstPreviewB2CTax();
}
function gstPreviewB2CTax(){const taxable=+document.getElementById('g1bTaxable')?.value||0,rate=+document.getElementById('g1bRate')?.value||0,pos=document.getElementById('g1bPos')?.value||'';const t=gstTaxCalc(taxable,rate,pos==='Kerala'?'Intra-State':'Inter-State');if(typeof t==='object'&&typeof t.igst==='number'){const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=gstMoney(v)};set('g1bpIgst',t.igst);set('g1bpCgst',t.cgst);set('g1bpSgst',t.sgst);set('g1bpCess',+document.getElementById('g1bCess')?.value||0)}}
function gstAddGstr1B2C(type){
  const m=document.getElementById('gstB2CMsg'),d=gstGstr1Data();
  if(d.status!=='Draft'){m.innerHTML='<span style="color:#9a2f2f">Return is frozen after submission.</span>';return}
  const inv=document.getElementById('g1bInv').value.trim(),date=document.getElementById('g1bDate').value,taxable=+document.getElementById('g1bTaxable').value||0,invoiceValue=+document.getElementById('g1bInvoiceValue').value||0,pos=document.getElementById('g1bPos').value,rate=+document.getElementById('g1bRate').value,nature=document.getElementById('g1bNature').value,cess=+document.getElementById('g1bCess').value||0;
  if(!inv||!date||invoiceValue<=0||taxable<0){m.innerHTML='<span style="color:#9a2f2f">Complete all mandatory fields.</span>';return}
  if(type==='B2C Large' && pos==='Kerala'){m.innerHTML='<span style="color:#9a2f2f">B2C Large is for the applicable inter-State consumer supply reporting category.</span>';return}if(type==='B2C Large' && invoiceValue<=100000){m.innerHTML='<span style="color:#9a2f2f">For the current training rule, B2C Large requires an inter-State consumer invoice above ₹1,00,000.</span>';return}
  if(d.b2c.some(x=>x.invoiceNo.toUpperCase()===inv.toUpperCase()&&x.date===date&&x.type===type)){m.innerHTML='<span style="color:#9a2f2f">Duplicate record detected for this period.</span>';return}
  const t=gstTaxCalc(taxable,rate,pos==='Kerala'?'Intra-State':'Inter-State');const item={type,invoiceNo:inv,date,pos,invoiceValue,taxable,rate,nature,cess,igst:t.igst,cgst:t.cgst,sgst:t.sgst,savedAt:new Date().toISOString()};d.b2c.push(item);d.savedAt=new Date().toISOString();gstSaveGstr1(d);gstGstr1B2C();
}
function gstDeleteGstr1B2C(i){const d=gstGstr1Data();if(d.status!=='Draft'){notify('Submitted return records cannot be deleted');return}d.b2c.splice(i,1);gstSaveGstr1(d);gstGstr1B2C()}

function gstGstr1Exports(){const d=gstGstr1Data();const rows=(d.exports||[]).map((x,i)=>`<tr><td>${esc(x.invoiceNo)}</td><td>${esc(x.date)}</td><td>${esc(x.type)}</td><td>${esc(x.port)}</td><td>${esc(x.sb||'—')}</td><td>${gstMoney(x.taxable)}</td><td>${gstMoney(x.igst)}</td><td><button class="gst-action secondary" onclick="gstDeleteGstr1Export(${i})">DELETE</button></td></tr>`).join('')||'<tr><td colspan="8" class="empty-state">No export / SEZ records.</td></tr>';
  feature('GSTR-1 — Exports / SEZ','Services > Returns > GSTR-1 > ADD RECORD DETAILS > Exports / SEZ',`<div class="gst-pagebar"><div><b>6A, 6B, 6C — Exports / SEZ / Deemed Exports</b><div class="muted">Export invoices, SEZ supplies and deemed exports</div></div><button class="gst-action secondary" onclick="gstOpenGstr1()">BACK</button></div>
  <div class="gst-alert info"><b>Export / SEZ reporting</b><br>Use the applicable supply type. Shipping Bill / Bill of Export information can be entered where available. ICEGATE transmission remains simulated and offline.</div>
  <div class="gst-section-title">Add Export / SEZ Record</div>
  <div class="gst-form-grid">
    <div><label>Supply Category *</label><select id="g1eType" class="f-select"><option>Export with payment of IGST</option><option>Export without payment of IGST</option><option>SEZ supplies with payment of IGST</option><option>SEZ supplies without payment of IGST</option><option>Deemed Export</option></select></div>
    <div><label>Invoice Number *</label><input id="g1eInv" class="f-input" maxlength="16"></div>
    <div><label>Invoice Date *</label><input id="g1eDate" type="date" class="f-input"></div>
    <div><label>Port Code</label><input id="g1ePort" class="f-input" maxlength="6" placeholder="INMAA1"></div>
    <div><label>Shipping Bill / Bill of Export No.</label><input id="g1eSb" class="f-input"></div>
    <div><label>Shipping Bill Date</label><input id="g1eSbDate" type="date" class="f-input"></div>
    <div><label>Recipient / SEZ GSTIN</label><input id="g1eGstin" class="f-input" maxlength="15"></div>
    <div><label>Place of Supply</label><select id="g1ePos" class="f-select"><option>Outside India</option><option>Kerala</option><option>Other State</option></select></div>
    <div><label>Taxable Value *</label><input id="g1eTaxable" type="number" min="0" step="0.01" class="f-input"></div>
    <div><label>IGST</label><input id="g1eIgst" type="number" min="0" step="0.01" class="f-input"></div>
    <div><label>CESS</label><input id="g1eCess" type="number" min="0" step="0.01" value="0" class="f-input"></div>
  </div>
  <div class="gst-action-row"><button class="gst-action" onclick="gstAddGstr1Export()">SAVE</button><button class="gst-action secondary" onclick="gstOpenGstr1()">BACK</button></div><div id="gstExportMsg" class="demo-note"></div>
  <div class="gst-section-title">Saved Export / SEZ Records</div><table class="gst-table gst-portal-table"><thead><tr><th>Invoice</th><th>Date</th><th>Category</th><th>Port</th><th>SB/BOE</th><th>Taxable</th><th>IGST</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>`)}
function gstAddGstr1Export(){const m=document.getElementById('gstExportMsg'),d=gstGstr1Data();if(d.status!=='Draft'){m.innerHTML='<span style="color:#9a2f2f">Return is frozen after submission.</span>';return}const x={type:document.getElementById('g1eType').value,invoiceNo:document.getElementById('g1eInv').value.trim(),date:document.getElementById('g1eDate').value,port:document.getElementById('g1ePort').value.trim().toUpperCase(),sb:document.getElementById('g1eSb').value.trim(),sbDate:document.getElementById('g1eSbDate').value,gstin:document.getElementById('g1eGstin').value.trim().toUpperCase(),pos:document.getElementById('g1ePos').value,taxable:+document.getElementById('g1eTaxable').value||0,igst:+document.getElementById('g1eIgst').value||0,cess:+document.getElementById('g1eCess').value||0};if(!x.invoiceNo||!x.date||x.taxable<=0){m.innerHTML='<span style="color:#9a2f2f">Invoice number, invoice date and taxable value are mandatory.</span>';return}if(d.exports.some(y=>y.invoiceNo.toUpperCase()===x.invoiceNo.toUpperCase()&&y.date===x.date)){m.innerHTML='<span style="color:#9a2f2f">Duplicate export invoice detected for this period.</span>';return}d.exports.push(x);gstSaveGstr1(d);gstGstr1Exports()}
function gstDeleteGstr1Export(i){const d=gstGstr1Data();if(d.status!=='Draft'){notify('Submitted return records cannot be deleted');return}d.exports.splice(i,1);gstSaveGstr1(d);gstGstr1Exports()}

function gstGstr1Hsn(){const d=gstGstr1Data();feature('GSTR-1 — HSN / SAC Summary','GSTR-1 > HSN/SAC',`<div class="gst-alert info">Add HSN/SAC summary records for the current period. Duplicate HSN/SAC + rate combinations are rejected in this training simulator.</div><div class="gst-form-grid"><div><label>HSN/SAC</label><input id="g1hCode" class="f-input"></div><div><label>Description</label><input id="g1hDesc" class="f-input"></div><div><label>UQC</label><select id="g1hUqc" class="f-select"><option>OTH-Others</option><option>NOS-Numbers</option><option>KGS-Kilograms</option><option>LTR-Litre</option></select></div><div><label>Quantity</label><input id="g1hQty" type="number" min="0" class="f-input"></div><div><label>Taxable Value</label><input id="g1hTaxable" type="number" min="0" step="0.01" class="f-input"></div><div><label>Rate</label><select id="g1hRate" class="f-select"><option>5</option><option selected>18</option><option>40</option></select></div></div><div class="gst-action-row"><button class="gst-action" onclick="gstAddGstr1Hsn()">ADD</button><button class="gst-action secondary" onclick="gstOpenGstr1()">BACK</button></div><div id="gstHsnMsg" class="demo-note"></div><table class="gst-table"><thead><tr><th>HSN/SAC</th><th>Description</th><th>UQC</th><th>Qty</th><th>Taxable</th><th>Rate</th></tr></thead><tbody>${d.hsn.map(x=>`<tr><td>${esc(x.code)}</td><td>${esc(x.desc)}</td><td>${esc(x.uqc)}</td><td>${x.qty}</td><td>${gstMoney(x.taxable)}</td><td>${x.rate}%</td></tr>`).join('')||'<tr><td colspan="6">No HSN/SAC records.</td></tr>'}</tbody></table>`)}
function gstAddGstr1Hsn(){const m=document.getElementById('gstHsnMsg'),d=gstGstr1Data();const x={code:document.getElementById('g1hCode').value.trim(),desc:document.getElementById('g1hDesc').value.trim(),uqc:document.getElementById('g1hUqc').value,qty:+document.getElementById('g1hQty').value||0,taxable:+document.getElementById('g1hTaxable').value||0,rate:+document.getElementById('g1hRate').value};if(d.status!=='Draft'){m.innerHTML='<span style="color:#9a2f2f">Return is frozen after submission.</span>';return}if(!x.code||x.taxable<=0){m.innerHTML='<span style="color:#9a2f2f">HSN/SAC and taxable value are mandatory.</span>';return}if(d.hsn.some(y=>y.code===x.code&&y.rate===x.rate)){m.innerHTML='<span style="color:#9a2f2f">Duplicate HSN/SAC and tax-rate combination.</span>';return}d.hsn.push(x);gstSaveGstr1(d);gstGstr1Hsn()}
function gstGstr1Documents(){const d=gstGstr1Data();feature('GSTR-1 — Documents Issued','GSTR-1 > Documents Issued',`<div class="gst-alert info">Maintain the simulated document series for the selected return period.</div><div class="gst-form-grid"><div><label>Document Type</label><select id="g1dType" class="f-select"><option>Invoices for outward supply</option><option>Credit Note</option><option>Debit Note</option><option>Receipt Voucher</option><option>Refund Voucher</option><option>Delivery Challan</option></select></div><div><label>From Serial No.</label><input id="g1dFrom" class="f-input"></div><div><label>To Serial No.</label><input id="g1dTo" class="f-input"></div><div><label>Total Number</label><input id="g1dTotal" type="number" min="0" class="f-input"></div><div><label>Cancelled</label><input id="g1dCancel" type="number" min="0" value="0" class="f-input"></div></div><div class="gst-action-row"><button class="gst-action" onclick="gstAddGstr1Doc()">SAVE</button><button class="gst-action secondary" onclick="gstOpenGstr1()">BACK</button></div><div id="gstDocMsg" class="demo-note"></div><table class="gst-table"><thead><tr><th>Type</th><th>From</th><th>To</th><th>Total</th><th>Cancelled</th></tr></thead><tbody>${d.documents.map(x=>`<tr><td>${esc(x.type)}</td><td>${esc(x.from)}</td><td>${esc(x.to)}</td><td>${x.total}</td><td>${x.cancelled}</td></tr>`).join('')||'<tr><td colspan="5">No document-series records.</td></tr>'}</tbody></table>`)}
function gstAddGstr1Doc(){const m=document.getElementById('gstDocMsg'),d=gstGstr1Data(),x={type:document.getElementById('g1dType').value,from:document.getElementById('g1dFrom').value.trim(),to:document.getElementById('g1dTo').value.trim(),total:+document.getElementById('g1dTotal').value||0,cancelled:+document.getElementById('g1dCancel').value||0};if(d.status!=='Draft'){m.innerHTML='<span style="color:#9a2f2f">Return is frozen after submission.</span>';return}if(!x.from||!x.to||x.total<0||x.cancelled<0||x.cancelled>x.total){m.innerHTML='<span style="color:#9a2f2f">Enter valid document-series details.</span>';return}d.documents.push(x);gstSaveGstr1(d);gstGstr1Documents()}
function gstGstr1GenerateSummary(){const d=gstGstr1Data(),s=gstGstr1Summary(d);d.summary=s;d.summaryGeneratedAt=new Date().toISOString();gstSaveGstr1(d);document.getElementById('gstGstr1Msg').innerHTML='<span style="color:#176b35"><b>GSTR-1 summary generated successfully.</b> '+s.count+' outward records; taxable value '+gstMoney(s.taxable)+'.</span>'}
function gstGstr1Validate(){const d=gstGstr1Data(),m=document.getElementById('gstGstr1Msg');const errors=[];for(const x of d.invoices){if(!x.invoiceNo)errors.push('B2B invoice number missing');if(!x.recipientGstin)errors.push('Recipient GSTIN missing');if((+x.taxable||0)<=0)errors.push('Taxable value must be greater than zero')}if(d.hsn.length===0&&d.invoices.length>0)errors.push('Review HSN/SAC summary for reported taxable supplies');if(errors.length){m.innerHTML='<span style="color:#9a2f2f"><b>Validation failed.</b><ul>'+errors.map(e=>'<li>'+e+'</li>').join('')+'</ul></span>';return}d.status='Validated';d.validatedAt=new Date().toISOString();gstSaveGstr1(d);m.innerHTML='<span style="color:#176b35"><b>GSTR-1 validated successfully.</b> You can generate the summary, preview and submit.</span>';}
function gstGstr1Preview(){const d=gstGstr1Data(),s=gstGstr1Summary(d);feature('GSTR-1 — Preview','GSTR-1 > Preview',`<div class="gst-alert info">Draft preview for ${esc(gstReturnContext().period)}. This is a simulated training document and is not a government filing.</div><div class="gst-section-title">Summary</div><table class="gst-table"><tr><th>Total Records</th><td>${s.count}</td></tr><tr><th>Taxable Value</th><td>${gstMoney(s.taxable)}</td></tr><tr><th>IGST</th><td>${gstMoney(s.igst)}</td></tr><tr><th>CGST</th><td>${gstMoney(s.cgst)}</td></tr><tr><th>SGST/UTGST</th><td>${gstMoney(s.sgst)}</td></tr></table><div class="gst-section-title">B2B Records</div><table class="gst-table"><thead><tr><th>Invoice</th><th>GSTIN</th><th>Taxable</th><th>IGST</th><th>CGST</th><th>SGST</th></tr></thead><tbody>${d.invoices.map(x=>`<tr><td>${esc(x.invoiceNo)}</td><td>${esc(x.recipientGstin)}</td><td>${gstMoney(x.taxable)}</td><td>${gstMoney(x.igst)}</td><td>${gstMoney(x.cgst)}</td><td>${gstMoney(x.sgst)}</td></tr>`).join('')||'<tr><td colspan="6">No B2B records.</td></tr>'}</tbody></table><div class="gst-action-row"><button class="gst-action" onclick="gstOpenGstr1()">BACK TO GSTR-1</button></div>`)}
function gstGstr1Submit(){const d=gstGstr1Data(),m=document.getElementById('gstGstr1Msg');if(d.status!=='Validated'){m.innerHTML='<span style="color:#9a2f2f"><b>Submit is unavailable.</b> Validate the GSTR-1 first and correct any errors.</span>';return}d.status='Submitted';d.submittedAt=new Date().toISOString();d.reference='GSTR1-SIM-'+Date.now().toString().slice(-10);gstSaveGstr1(d);m.innerHTML='<span style="color:#176b35"><b>GSTR-1 submitted successfully in the training simulator.</b><br>Reference: '+d.reference+'<br>The submitted return is now frozen for this period.</span>';setTimeout(gstOpenGstr1,300)}
/* Use the new detailed GSTR-1 workspace from all entry points. */
const _oldGstOpenReturn=window.gstOpenReturn;
window.gstOpenReturn=function(name){if(name==='GSTR-1')return gstOpenGstr1();return _oldGstOpenReturn(name)};



/* ===== GSTR-1A — current-period amendment / missed-supply workflow ===== */
(function(){
  function g1aKey(){const c=gstReturnContext();return 'gstGstr1A_'+c.fy+'_'+c.period.replace(/[^A-Za-z0-9]/g,'_')}
  function g1aDefault(){return {status:'Draft',adds:[],amends:[],summary:null,summaryAt:null,submittedAt:null,filedAt:null,reference:null,audit:[]}}
  window.gstGstr1AData=function(){return gstRead(g1aKey(),g1aDefault())}
  function save1a(d){gstWrite(g1aKey(),d)}
  function g1aGstr1(){const c=gstReturnContext();return gstRead('gstGstr1_'+c.fy+'_'+c.period.replace(/[^A-Za-z0-9]/g,'_'),null)}
  function g1aGstr3B(){const c=gstReturnContext();const d=typeof gst3bData==='function'?gst3bData():null;return d&&d.status?d:null}
  function g1aAvailable(){const g=g1aGstr1(),b=g1aGstr3B();return !!(g&&['Submitted','Filed'].includes(g.status)) && !(b&&b.status==='Filed')}
  function g1aReason(){const g=g1aGstr1(),b=g1aGstr3B();if(!g)return 'GSTR-1 for this period must be furnished before GSTR-1A becomes available.';if(!['Submitted','Filed'].includes(g.status))return 'Furnish GSTR-1 for this tax period before opening GSTR-1A.';if(b&&b.status==='Filed')return 'GSTR-1A is no longer available after GSTR-3B for the same tax period has been filed.';return ''}
  window.gstOpenGstr1A=function(){
    if(!gstRequireLogin('GSTR-1A'))return;
    const c=gstReturnContext(),d=gstGstr1AData(),g=g1aGstr1(),b=g1aGstr3B();
    const unavailable=g1aReason();
    if(unavailable){feature('GSTR-1A — Not Available','Services > Returns > Returns Dashboard > GSTR-1A',`<div class="gst-alert warning"><b>GSTR-1A is not available for ${esc(c.period)}.</b><br>${esc(unavailable)}</div><div class="gst-section-title">Availability rule</div><table class="gst-table"><tr><th>GSTR-1 status</th><td>${esc(g&&g.status||'Not Furnished')}</td><th>GSTR-3B status</th><td>${esc(b&&b.status||'Not Filed')}</td></tr></table><div class="gst-alert info">GSTR-1A is an optional facility for the same tax period. It becomes available after GSTR-1 is furnished and remains available until GSTR-3B for that period is filed.</div><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK TO RETURNS DASHBOARD</button>`);return;}
    feature('GSTR-1A — Amendment of GSTR-1','Services > Returns > Returns Dashboard > GSTR-1A',g1aBody(d,c));
  };
  function countFor(d,type){return (d.adds||[]).filter(x=>x.type===type).length+(d.amends||[]).filter(x=>x.type===type).length}
  function g1aBody(d,c){
    const frozen=['Submitted','Filed'].includes(d.status),g=g1aGstr1(),b=g1aGstr3B();
    const addTiles=[['B2B / SEZ / Deemed Export','Add missed B2B supply','B2B',countFor(d,'B2B')],['B2C / Other outward supply','Add missed consumer supply','B2C',countFor(d,'B2C')],['Export / SEZ supply','Add missed zero-rated supply','EXPORT',countFor(d,'EXPORT')],['Credit / Debit Note','Add missed registered/unregistered note','NOTE',countFor(d,'NOTE')]];
    const amendTiles=[['B2B','Amend a furnished B2B record','B2B',countFor(d,'B2B')],['B2C','Amend a furnished B2C record','B2C',countFor(d,'B2C')],['Export','Amend a furnished export record','EXPORT',countFor(d,'EXPORT')],['Credit / Debit Note','Amend a furnished note','NOTE',countFor(d,'NOTE')]];
    return `<div class="gst-dash-head"><h2>GSTR-1A — Amendment of GSTR-1</h2><div class="gst-dash-meta"><span>Financial Year: <b>${esc(c.fy)}</b></span><span>Return Period: <b>${esc(c.period)}</b></span><span>GSTR-1: <b>${esc(g.status)}</b></span><span>Status: <b>${esc(d.status)}</b></span></div></div>
    <div class="gst-alert info"><b>GSTR-1A is an optional amendment facility.</b><br>You can amend records furnished in GSTR-1 or add missed supplies for the same tax period after GSTR-1 is furnished and before GSTR-3B is filed. The corrected values are available for downstream GSTR-3B assistance in this training simulator.</div>
    <div class="gst-alert warning"><b>Important:</b> GSTR-1A has no separate due date. It remains available until GSTR-3B for ${esc(c.period)} is filed. Submitted GSTR-1A records are frozen.</div>
    <div class="gst-section-title">ADD MISSED SUPPLY / RECORD DETAILS</div><div class="gst-tile-grid">${addTiles.map(t=>`<div class="gst-return-tile"><div class="rt-head">${t[0]}</div><div class="rt-body"><div class="rt-row"><span>${t[1]}</span><b>${t[3]}</b></div><div class="rt-actions"><button class="gst-action" onclick="${frozen?'notify(\'GSTR-1A is frozen after submission\')':`gstGstr1AOpenAdd('${t[2]}')`}">ADD RECORD</button></div></div></div>`).join('')}</div>
    <div class="gst-section-title">AMEND RECORD DETAILS</div><div class="gst-tile-grid">${amendTiles.map(t=>`<div class="gst-return-tile"><div class="rt-head">${t[0]}</div><div class="rt-body"><div class="rt-row"><span>${t[1]}</span><b>${t[3]}</b></div><div class="rt-actions"><button class="gst-action" onclick="${frozen?'notify(\'GSTR-1A is frozen after submission\')':`gstGstr1AOpenAmend('${t[2]}')`}">AMEND RECORD</button></div></div></div>`).join('')}</div>
    <div class="gst-section-title">GSTR-1A Summary</div><table class="gst-table"><tr><th>Added / Amended Records</th><td>${(d.adds||[]).length+(d.amends||[]).length}</td><th>Last Summary</th><td>${d.summaryAt?esc(new Date(d.summaryAt).toLocaleString('en-IN')):'Not generated'}</td></tr><tr><th>GSTR-1</th><td>${esc(g.status)}</td><th>GSTR-3B</th><td>${esc(b&&b.status||'Not Filed')}</td></tr></table>
    <div class="gst-action-row" style="flex-wrap:wrap"><button class="gst-action" onclick="gstGstr1AGenerateSummary()">GENERATE SUMMARY</button><button class="gst-action secondary" onclick="gstGstr1APreview()">PREVIEW</button><button class="gst-action" onclick="gstGstr1AValidate()">VALIDATE</button><button class="gst-action" onclick="${frozen?'notify(\'GSTR-1A is already submitted/frozen\')':'gstGstr1ASubmitPage()'}">PROCEED TO FILE</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK</button></div><div id="gstGstr1AMsg" class="demo-note"></div>`;
  }
  window.gstGstr1AOpenAdd=function(type){const d=gstGstr1AData();if(['Submitted','Filed'].includes(d.status)){notify('GSTR-1A is frozen after submission');return}const labels={B2B:'B2B / SEZ / Deemed Export',B2C:'B2C / Other outward supply',EXPORT:'Export / SEZ supply',NOTE:'Credit / Debit Note'};feature('GSTR-1A — Add Missed Supply','GSTR-1A > ADD RECORD DETAILS > '+labels[type],`<div class="gst-alert info"><b>Add a missed record for ${esc(gstReturnContext().period)}.</b><br>This record is an addition/correction for the same tax period; it is not a new return.</div><div class="gst-form-grid"><div><label>Record Type *</label><input id="g1aAddType" class="f-input" value="${esc(labels[type])}" readonly></div><div><label>Document Number *</label><input id="g1aAddNo" class="f-input"></div><div><label>Document Date *</label><input id="g1aAddDate" type="date" class="f-input"></div><div><label>Recipient / Counterparty GSTIN</label><input id="g1aAddGstin" class="f-input" placeholder="15-character GSTIN for registered recipient"></div><div><label>Place of Supply *</label><select id="g1aAddPos" class="f-select"><option>Kerala</option><option>Inter-State</option><option>Tamil Nadu</option><option>Karnataka</option></select></div><div><label>Taxable Value *</label><input id="g1aAddTax" type="number" min="0" step="0.01" class="f-input"></div><div><label>Tax Rate *</label><select id="g1aAddRate" class="f-select"><option>5</option><option selected>18</option><option>40</option></select></div><div><label>Cess</label><input id="g1aAddCess" type="number" min="0" step="0.01" value="0" class="f-input"></div></div><div class="gst-action-row"><button class="gst-action" onclick="gstGstr1AAddSave('${esc(type)}')">SAVE</button><button class="gst-action secondary" onclick="gstOpenGstr1A()">BACK</button></div><div id="g1aAddMsg" class="demo-note"></div><div class="gst-section-title">Saved GSTR-1A Records</div>${g1aRows(d.adds.filter(x=>x.type===type),'ADD')}`)};
  function validGstin(v){return !v||/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v)}
  window.gstGstr1AAddSave=function(type){const d=gstGstr1AData(),m=document.getElementById('g1aAddMsg');const v={type,docNo:document.getElementById('g1aAddNo').value.trim(),date:document.getElementById('g1aAddDate').value,gstin:document.getElementById('g1aAddGstin').value.trim().toUpperCase(),pos:document.getElementById('g1aAddPos').value,taxable:+document.getElementById('g1aAddTax').value||0,rate:+document.getElementById('g1aAddRate').value,cess:+document.getElementById('g1aAddCess').value||0,createdAt:new Date().toISOString()};if(!v.docNo||!v.date||v.taxable<=0){m.innerHTML='<span style="color:#9a2f2f">Document number, date and taxable value are mandatory.</span>';return}if(!validGstin(v.gstin)){m.innerHTML='<span style="color:#9a2f2f">Enter a valid GSTIN format or leave the field blank for an unregistered recipient.</span>';return}if(d.adds.some(x=>x.type===type&&x.docNo.toUpperCase()===v.docNo.toUpperCase()&&x.date===v.date)){m.innerHTML='<span style="color:#9a2f2f">Duplicate GSTR-1A record detected for this period.</span>';return}Object.assign(v,gstTaxCalc(v.taxable,v.rate,v.pos));d.adds.push(v);d.audit.push({at:new Date().toISOString(),action:'ADD MISSED SUPPLY',reference:v.docNo});save1a(d);m.innerHTML='<span style="color:#176b35"><b>Record saved successfully.</b></span>';setTimeout(()=>gstGstr1AOpenAdd(type),250)};
  window.gstGstr1AOpenAmend=function(type){const d=gstGstr1AData();if(['Submitted','Filed'].includes(d.status)){notify('GSTR-1A is frozen after submission');return}const g=g1aGstr1()||{},src=type==='B2B'?(g.invoices||[]):type==='B2C'?(g.b2c||[]):type==='EXPORT'?(g.exports||[]):(g.notes||[]);const opts=src.map((x,i)=>`<option value="${i}">${esc(x.invoiceNo||x.noteNo||('Record '+(i+1)))} — ${esc(x.date||x.invoiceDate||x.noteDate||'')}</option>`).join('');const labels={B2B:'B2B',B2C:'B2C / Other',EXPORT:'Export / SEZ',NOTE:'Credit / Debit Note'};feature('GSTR-1A — Amend Record','GSTR-1A > AMEND RECORD DETAILS > '+labels[type],`<div class="gst-alert info"><b>Select the record furnished in GSTR-1 that needs correction.</b><br>Only records from the same tax period are available in this training simulator.</div><div class="gst-form-grid"><div><label>Original Record *</label><select id="g1aAmSource" class="f-select">${opts||'<option value="">No eligible GSTR-1 records found</option>'}</select></div><div><label>Amendment Reason *</label><input id="g1aAmReason" class="f-input" placeholder="Reason for amendment"></div><div><label>Revised Document Date</label><input id="g1aAmDate" type="date" class="f-input"></div><div><label>Revised Taxable Value *</label><input id="g1aAmTax" type="number" min="0" step="0.01" class="f-input"></div><div><label>Revised Tax Rate *</label><select id="g1aAmRate" class="f-select"><option>5</option><option selected>18</option><option>40</option></select></div><div><label>Revised Place of Supply</label><select id="g1aAmPos" class="f-select"><option>Kerala</option><option>Inter-State</option><option>Tamil Nadu</option><option>Karnataka</option></select></div></div><div class="gst-action-row"><button class="gst-action" onclick="gstGstr1AAmendSave('${esc(type)}')">SAVE AMENDMENT</button><button class="gst-action secondary" onclick="gstOpenGstr1A()">BACK</button></div><div id="g1aAmMsg" class="demo-note"></div><div class="gst-section-title">Saved Amendments</div>${g1aRows(d.amends.filter(x=>x.type===type),'AMEND')}`)};
  window.gstGstr1AAmendSave=function(type){const d=gstGstr1AData(),g=g1aGstr1(),m=document.getElementById('g1aAmMsg'),sel=document.getElementById('g1aAmSource');if(!sel||!sel.value&&!(sel.selectedOptions&&sel.selectedOptions.length)){m.innerHTML='<span style="color:#9a2f2f">Select an original GSTR-1 record.</span>';return}const src=(type==='B2B'?(g?.invoices||[]):type==='B2C'?(g?.b2c||[]):type==='EXPORT'?(g?.exports||[]):(g?.notes||[]))[Number(sel.value)];const v={type,original:sel.selectedOptions[0].text,reason:document.getElementById('g1aAmReason').value.trim(),date:document.getElementById('g1aAmDate').value,taxable:+document.getElementById('g1aAmTax').value||0,rate:+document.getElementById('g1aAmRate').value,pos:document.getElementById('g1aAmPos').value,createdAt:new Date().toISOString()};if(!src||!v.reason||v.taxable<=0){m.innerHTML='<span style="color:#9a2f2f">Select a record and enter amendment reason and revised taxable value.</span>';return}Object.assign(v,gstTaxCalc(v.taxable,v.rate,v.pos));d.amends.push(v);d.audit.push({at:new Date().toISOString(),action:'AMEND GSTR-1 RECORD',reference:v.original});save1a(d);m.innerHTML='<span style="color:#176b35"><b>Amendment saved successfully.</b></span>';setTimeout(()=>gstGstr1AOpenAmend(type),250)};
  function g1aRows(arr,mode){return `<table class="gst-table"><thead><tr><th>Type</th><th>Document / Original</th><th>Date</th><th>Taxable</th><th>IGST</th><th>CGST</th><th>SGST</th></tr></thead><tbody>${arr.map(x=>`<tr><td>${mode}</td><td>${esc(x.docNo||x.original)}</td><td>${esc(x.date||'')}</td><td>${gstMoney(x.taxable)}</td><td>${gstMoney(x.igst)}</td><td>${gstMoney(x.cgst)}</td><td>${gstMoney(x.sgst)}</td></tr>`).join('')||'<tr><td colspan="7">No records saved.</td></tr>'}</tbody></table>`}
  window.gstGstr1AGenerateSummary=function(){const d=gstGstr1AData(),all=[...(d.adds||[]),...(d.amends||[])];d.summary={count:all.length,taxable:all.reduce((a,x)=>a+(+x.taxable||0),0),igst:all.reduce((a,x)=>a+(+x.igst||0),0),cgst:all.reduce((a,x)=>a+(+x.cgst||0),0),sgst:all.reduce((a,x)=>a+(+x.sgst||0),0)};d.summaryAt=new Date().toISOString();save1a(d);const m=document.getElementById('gstGstr1AMsg');if(m)m.innerHTML='<span style="color:#176b35"><b>GSTR-1A summary generated successfully.</b> '+d.summary.count+' amendment/addition records.</span>';else gstOpenGstr1A()}
  window.gstGstr1AValidate=function(){const d=gstGstr1AData(),m=document.getElementById('gstGstr1AMsg'),e=[];if(!d.summary)e.push('Generate the GSTR-1A summary before validation.');if(!d.adds.length&&!d.amends.length)e.push('Add or amend at least one record, or leave GSTR-1A unused; filing is optional.');if(d.summary&&d.summary.taxable<0)e.push('Taxable value cannot be negative.');if(e.length){m.innerHTML='<span style="color:#9a2f2f"><b>Validation failed.</b><ul>'+e.map(esc).map(x=>'<li>'+x+'</li>').join('')+'</ul></span>';return false}d.status='Validated';d.validatedAt=new Date().toISOString();save1a(d);m.innerHTML='<span style="color:#176b35"><b>GSTR-1A validated successfully.</b> You can preview and proceed to file.</span>';return true}
  window.gstGstr1APreview=function(){const d=gstGstr1AData(),s=d.summary||{count:0,taxable:0,igst:0,cgst:0,sgst:0};feature('GSTR-1A — Preview','GSTR-1A > Preview',`<div class="gst-alert info">Preview for ${esc(gstReturnContext().period)}. This is a simulated training statement and is not a government filing.</div><table class="gst-table"><tr><th>Total Additions/Amendments</th><td>${s.count}</td><th>Taxable Value</th><td>${gstMoney(s.taxable)}</td></tr><tr><th>IGST</th><td>${gstMoney(s.igst)}</td><th>CGST</th><td>${gstMoney(s.cgst)}</td></tr><tr><th>SGST/UTGST</th><td>${gstMoney(s.sgst)}</td><th>Status</th><td>${esc(d.status)}</td></tr></table>${g1aRows([...(d.adds||[]),...(d.amends||[])],'GSTR-1A')}<div class="gst-action-row"><button class="gst-action secondary" onclick="gstOpenGstr1A()">BACK TO GSTR-1A</button></div>`)}
  window.gstGstr1ASubmitPage=function(){if(!gstGstr1AValidate())return;const d=gstGstr1AData();feature('GSTR-1A — File','GSTR-1A > File',`<div class="gst-alert info"><b>Final filing</b><br>Review the declaration and choose the simulated filing method. Real GSTN credentials are never collected.</div><div class="gst-form-grid"><div><label>Authorized Signatory *</label><input id="g1aSigner" class="f-input" value="Demo Authorized Signatory"></div><div><label>Filing Mode</label><select id="g1aMode" class="f-select"><option>EVC</option><option>DSC</option></select></div><div><label>Simulated OTP</label><input id="g1aOtp" class="f-input" placeholder="123456"></div></div><div class="gst-alert warning">By filing in this training simulator you confirm that the data is simulated. A simulated ARN will be generated.</div><button class="gst-action" onclick="gstGstr1AFile()">FILE GSTR-1A</button> <button class="gst-action secondary" onclick="gstOpenGstr1A()">BACK</button><div id="g1aFileMsg" class="demo-note"></div>`)};
  window.gstGstr1AFile=function(){const d=gstGstr1AData(),m=document.getElementById('g1aFileMsg'),sign=document.getElementById('g1aSigner')?.value.trim(),otp=document.getElementById('g1aOtp')?.value.trim();if(d.status!=='Validated'){m.innerHTML='<span style="color:#9a2f2f">Validate GSTR-1A before filing.</span>';return}if(!sign||otp!=='123456'){m.innerHTML='<span style="color:#9a2f2f">Enter the authorized signatory and simulated OTP 123456.</span>';return}if(!g1aAvailable()){m.innerHTML='<span style="color:#9a2f2f">GSTR-1A is no longer available for filing.</span>';return}d.status='Filed';d.filedAt=new Date().toISOString();d.reference='SIM-GSTR1A-'+Date.now().toString().slice(-10);d.signatory=sign;d.filingMode=document.getElementById('g1aMode')?.value||'EVC';d.audit.push({at:d.filedAt,action:'FILE GSTR-1A',reference:d.reference});save1a(d);window.gstAddFiledReturn&&window.gstAddFiledReturn(d,'GSTR-1A');feature('GSTR-1A — Filed','Services > Returns > View e-Filed Returns',`<div class="gst-alert success"><b>GSTR-1A filed successfully in the training simulator.</b><br>Simulated ARN: <b>${esc(d.reference)}</b></div><table class="gst-table"><tr><th>Financial Year</th><td>${esc(gstReturnContext().fy)}</td><th>Return Period</th><td>${esc(gstReturnContext().period)}</td></tr><tr><th>Filing Mode</th><td>${esc(d.filingMode)}</td><th>Status</th><td><span class="gst-status green">Filed</span></td></tr><tr><th>ARN</th><td colspan="3">${esc(d.reference)}</td></tr></table><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK TO RETURNS DASHBOARD</button>`)};
  const oldOpenReturn=window.gstOpenReturn;
  window.gstOpenReturn=function(name){if(name==='GSTR-1A')return gstOpenGstr1A();return oldOpenReturn(name)};
  const oldG1Source=window.gst3bGstr1Source;
  window.gst3bGstr1Source=function(){const base=oldG1Source?oldG1Source():null,c=gstReturnContext(),a=gstRead('gstGstr1A_'+c.fy+'_'+c.period.replace(/[^A-Za-z0-9]/g,'_'),null);if(!a||!['Submitted','Filed'].includes(a.status))return base;if(!base)return base;const merged=JSON.parse(JSON.stringify(base));merged.invoices=[...(merged.invoices||[]),...(a.adds||[]).filter(x=>x.type==='B2B').map(x=>({invoiceNo:x.docNo,recipientGstin:x.gstin,taxable:x.taxable,igst:x.igst,cgst:x.cgst,sgst:x.sgst,cess:x.cess,pos:x.pos}))];merged.b2c=[...(merged.b2c||[]),...(a.adds||[]).filter(x=>x.type==='B2C').map(x=>({invoiceNo:x.docNo,taxable:x.taxable,igst:x.igst,cgst:x.cgst,sgst:x.sgst,cess:x.cess,pos:x.pos}))];merged.exports=[...(merged.exports||[]),...(a.adds||[]).filter(x=>x.type==='EXPORT').map(x=>({invoiceNo:x.docNo,taxable:x.taxable,igst:x.igst,cess:x.cess,pos:x.pos}))];merged.notes=[...(merged.notes||[]),...(a.adds||[]).filter(x=>x.type==='NOTE').map(x=>({noteNo:x.docNo,taxable:x.taxable,igst:x.igst,cgst:x.cgst,sgst:x.sgst,cess:x.cess,pos:x.pos}))];merged.gstr1a=a;return merged};
})();

/* ===== IMS — Invoice Management System / recipient workflow ===== */
function gstImsKey(){const c=gstReturnContext();return 'gstIMS_'+c.fy+'_'+c.period.replace(/[^A-Za-z0-9]/g,'_')}
function gstImsSeed(){
  const p=gstRead('gstTaxpayer',GST_DEMO), key=gstImsKey(), existing=localStorage.getItem(key);
  if(existing!==null) return gstRead(key,{records:[]});
  const now=new Date().toISOString();
  const records=[
    {id:'IMS-B2B-1001',source:'GSTR-1',type:'B2B Invoice',supplierGstin:'29SUPPLIER1234F1Z5',supplierName:'Southern Components Pvt Ltd',invoiceNo:'SC/26-27/1045',invoiceDate:'2026-07-05',taxable:50000,igst:0,cgst:4500,sgst:4500,pos:'Kerala',itcEligible:true,action:'No Action',remark:'',itcReduction:0,createdAt:now},
    {id:'IMS-B2B-1002',source:'GSTR-1',type:'B2B Invoice',supplierGstin:'27SUPPLIER5678F1Z2',supplierName:'Maharashtra Industrial Supplies',invoiceNo:'MIS/784/26',invoiceDate:'2026-07-09',taxable:80000,igst:14400,cgst:0,sgst:0,pos:'Kerala',itcEligible:true,action:'No Action',remark:'',itcReduction:0,createdAt:now},
    {id:'IMS-CDN-1003',source:'GSTR-1',type:'Credit Note',supplierGstin:'29SUPPLIER1234F1Z5',supplierName:'Southern Components Pvt Ltd',invoiceNo:'CN/26-27/31',invoiceDate:'2026-07-15',taxable:-10000,igst:0,cgst:-900,sgst:-900,pos:'Kerala',itcEligible:true,action:'Pending',remark:'Review credit note before ITC adjustment',itcReduction:0,createdAt:now},
    {id:'IMS-BOE-1004',source:'Import of Goods',type:'IMPG',supplierGstin:'OVERSEAS',supplierName:'Overseas Supplier',invoiceNo:'BOE-7821456',invoiceDate:'2026-07-18',taxable:120000,igst:21600,cgst:0,sgst:0,pos:'Kerala',itcEligible:true,action:'No Action',remark:'',itcReduction:0,createdAt:now},
    {id:'IMS-BOE-1005',source:'Import of Goods',type:'IMPG Amendments',supplierGstin:'OVERSEAS',supplierName:'Overseas Supplier',invoiceNo:'BOE-7821456-A1',invoiceDate:'2026-07-20',taxable:125000,igst:22500,cgst:0,sgst:0,pos:'Kerala',itcEligible:true,action:'Pending',remark:'Review amended Bill of Entry',itcReduction:0,createdAt:now},
    {id:'IMS-BOE-1006',source:'Import of Goods',type:'IMPGSEZ',supplierGstin:'SEZ-IMPORT',supplierName:'SEZ Unit Supplier',invoiceNo:'SEZ/BOE/2291',invoiceDate:'2026-07-22',taxable:70000,igst:12600,cgst:0,sgst:0,pos:'Kerala',itcEligible:true,action:'No Action',remark:'',itcReduction:0,createdAt:now},
    {id:'IMS-BOE-1007',source:'Import of Goods',type:'IMPGSEZA Amendments',supplierGstin:'SEZ-IMPORT',supplierName:'SEZ Unit Supplier',invoiceNo:'SEZ/BOE/2291-A1',invoiceDate:'2026-07-24',taxable:72000,igst:12960,cgst:0,sgst:0,pos:'Kerala',itcEligible:true,action:'No Action',remark:'',itcReduction:0,createdAt:now},
    {id:'IMS-ISD-1008',source:'ISD',type:'ISD Credit',supplierGstin:'32ISDOFFICE001Z1',supplierName:'Head Office (ISD)',invoiceNo:'ISD/26-27/09',invoiceDate:'2026-07-12',taxable:0,igst:0,cgst:6000,sgst:6000,pos:'Kerala',itcEligible:true,action:'No Action',remark:'',itcReduction:0,createdAt:now}
  ];
  gstWrite(key,{records,updatedAt:now}); return {records};
}
function gstImsData(){return gstImsSeed()}
function gstSaveIms(d){d.updatedAt=new Date().toISOString();gstWrite(gstImsKey(),d)}
function gstImsSyncSupplierRecords(){
  const d=gstImsData(), p=gstRead('gstTaxpayer',GST_DEMO), seen=new Set((d.records||[]).map(x=>x.sourceId));
  const add=[];
  function consider(x, source, idx){
    const recipient=(x.recipientGstin||'').toUpperCase();
    if(recipient && recipient!==String(p.gstin).toUpperCase()) return;
    const sourceId=source+'-'+idx+'-'+(x.invoiceNo||x.reference||'record');
    if(seen.has(sourceId)) return;
    add.push({id:'IMS-'+Date.now()+'-'+idx,source,sourceId,type:'B2B Invoice',supplierGstin:x.supplierGstin||'29SUPPLIER1234F1Z5',supplierName:x.supplierName||'Supplier Taxpayer',invoiceNo:x.invoiceNo||x.reference||('REC-'+idx),invoiceDate:x.date||x.invoiceDate||new Date().toISOString().slice(0,10),taxable:+x.taxable||0,igst:+x.igst||0,cgst:+x.cgst||0,sgst:+x.sgst||0,pos:x.pos||'Kerala',itcEligible:true,action:'No Action',remark:'',itcReduction:0,createdAt:new Date().toISOString()});
  }
  const fy=p.fy||'2026-27',period=p.period||'Jul 2026';
  try{const g=gstRead('gstGstr1_'+fy+'_'+period.replace(/[^A-Za-z0-9]/g,'_'),null);if(g&&Array.isArray(g.invoices))g.invoices.forEach((x,i)=>consider(x,'GSTR-1',i));}catch(e){}
  try{const a=gstRead('gstGstr1A_'+fy+'_'+period.replace(/[^A-Za-z0-9]/g,'_'),null);if(a&&Array.isArray(a.records))a.records.forEach((x,i)=>consider(x,'GSTR-1A',i));}catch(e){}
  if(add.length){d.records.push(...add);gstSaveIms(d)}
  return d;
}
function gstImsCounts(records){return (records||[]).reduce((z,x)=>{const a=x.action||'No Action';z.all++;z[a.replace(/\s+/g,'').toLowerCase()] = (z[a.replace(/\s+/g,'').toLowerCase()]||0)+1; if(x.type==='B2B Invoice')z.b2b++; if(/Credit|Debit/.test(x.type))z.notes++; if(x.source==='Import of Goods')z.imports++; return z},{all:0,b2b:0,notes:0,imports:0})}
function gstImsActionAllowed(x,a){
  if(x.source==='Import of Goods' || x.type==='IMPG' || x.type==='IMPGSEZ') return a==='Accept'||a==='Pending';
  return ['Accept','Reject','Pending','No Action'].includes(a);
}
function gstOpenIMS(){
  if(!gstRequireLogin('IMS'))return;
  const d=gstImsSyncSupplierRecords();
  feature('Invoice Management System (IMS)','Services > Returns > Invoice Management System',gstImsBody(d,'All'));
}
function gstImsBody(d,filter){
  const recs=(d.records||[]).filter(x=>{
    if(filter==='All')return true;
    if(filter==='B2B')return x.type==='B2B Invoice';
    if(filter==='Credit/Debit Notes')return /Credit|Debit/.test(x.type);
    if(filter==='Imports of Goods')return x.source==='Import of Goods';
    return x.action===filter;
  });
  const c=gstImsCounts(d.records), ctx=gstReturnContext();
  const rows=recs.map(x=>{
    const options=(x.source==='Import of Goods'?['No Action','Accept','Pending']:['No Action','Accept','Reject','Pending']).map(a=>`<option ${x.action===a?'selected':''}>${a}</option>`).join('');
    const tax= (+x.igst||0)+(+x.cgst||0)+(+x.sgst||0);
    return `<tr>
      <td><b>${esc(x.supplierGstin)}</b><br><small>${esc(x.supplierName)}</small></td>
      <td>${esc(x.invoiceNo)}<br><small>${esc(x.invoiceDate)}</small></td>
      <td>${esc(x.type)}<br><small>${esc(x.source)}</small></td>
      <td>${gstMoney(x.taxable)}</td><td>${gstMoney(tax)}</td>
      <td><span class="gst-status ${x.action==='Accept'?'green':x.action==='Reject'?'orange':x.action==='Pending'?'blue':''}">${esc(x.action)}</span></td>
      <td><select class="f-select" id="imsAct_${esc(x.id)}">${options}</select><input class="f-input" id="imsRemark_${esc(x.id)}" value="${esc(x.remark||'')}" placeholder="Remark for reject/pending" style="margin-top:4px"><input class="f-input" id="imsRed_${esc(x.id)}" type="number" min="0" step="0.01" value="${Number(x.itcReduction||0)}" placeholder="ITC reduction" style="margin-top:4px"><button class="gst-action" style="margin-top:5px" onclick="gstImsSaveAction('${esc(x.id)}')">SAVE</button></td>
    </tr>`;
  }).join('')||'<tr><td colspan="7">No records available for this IMS view.</td></tr>';
  return `<div class="gst-alert info"><b>Invoice Management System (IMS)</b><br>Recipient taxpayers can review records saved/filed by suppliers through GSTR-1, GSTR-1A and IFF and take permitted actions for ITC. This is a local training simulation; no GSTN data is fetched.</div>
  <div class="gst-section-title">IMS Dashboard — Inward Supplies</div>
  <table class="gst-table"><tr><th>Financial Year</th><td>${esc(ctx.fy)}</td><th>Return Period</th><td>${esc(ctx.period)}</td></tr><tr><th>All Records</th><td>${c.all}</td><th>Accepted</th><td>${c.accept||0}</td></tr><tr><th>Rejected</th><td>${c.reject||0}</td><th>Pending</th><td>${c.pending||0}</td></tr><tr><th>No Action</th><td>${c.noaction||0}</td><th>Imports</th><td>${c.imports}</td></tr></table>
  <div class="gst-action-row" style="flex-wrap:wrap">
    ${['All','B2B','Credit/Debit Notes','Imports of Goods','Accepted','Rejected','Pending','No Action'].map(f=>`<button class="gst-action ${filter===f?'':'secondary'}" onclick="gstOpenIMSFilter('${f.replace(/'/g,"\\'")}')">${f}</button>`).join('')}
    <button class="gst-action secondary" onclick="gstImsAdvisory()">VIEW ADVISORY</button><button class="gst-action secondary" onclick="gstImsDownload()">DOWNLOAD EXCEL</button><button class="gst-action secondary" onclick="gstImsReset()">RESET</button>
  </div>
  <div class="gst-alert warning"><b>Important:</b> For this simulator, “No Action” is displayed explicitly. For ordinary IMS records, no action is treated as accepted for the corresponding GSTR-2B. Actions may be changed in the simulator until the corresponding GSTR-3B is filed.</div>
  <table class="gst-table"><thead><tr><th>Supplier GSTIN / Name</th><th>Invoice / Date</th><th>Record / Source</th><th>Taxable Value</th><th>Tax</th><th>Current Action</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="gst-action-row"><button class="gst-action" onclick="gstImsSaveAll()">SAVE</button><button class="gst-action secondary" onclick="gstImsDraft2B()">VIEW DRAFT GSTR-2B</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK TO RETURNS DASHBOARD</button></div><div id="gstImsMsg" class="demo-note"></div>`;
}
function gstOpenIMSFilter(filter){if(!gstRequireLogin('IMS'))return;feature('Invoice Management System (IMS)','Services > Returns > Invoice Management System',gstImsBody(gstImsSyncSupplierRecords(),filter))}
function gstImsSaveAction(id){
  const d=gstImsData(),x=d.records.find(r=>r.id===id),m=document.getElementById('gstImsMsg');if(!x)return;
  const action=document.getElementById('imsAct_'+id)?.value||'No Action',remark=document.getElementById('imsRemark_'+id)?.value.trim()||'',red=+document.getElementById('imsRed_'+id)?.value||0;
  if(!gstImsActionAllowed(x,action)){if(m)m.innerHTML='<span style="color:#9a2f2f">This action is not permitted for this record type.</span>';return}
  if((action==='Reject'||action==='Pending')&&!remark){if(m)m.innerHTML='<span style="color:#9a2f2f">A remark is required when rejecting or keeping a record pending.</span>';return}
  const tax=Math.abs((+x.igst||0)+(+x.cgst||0)+(+x.sgst||0));if(red>tax){if(m)m.innerHTML='<span style="color:#9a2f2f">ITC reduction cannot exceed the tax amount on this record.</span>';return}
  x.action=action;x.remark=remark;x.itcReduction=red;x.updatedAt=new Date().toISOString();gstSaveIms(d);gstOpenIMSFilter('All');
}
function gstImsSaveAll(){const d=gstImsData();for(const x of d.records){const a=document.getElementById('imsAct_'+x.id),r=document.getElementById('imsRemark_'+x.id),red=document.getElementById('imsRed_'+x.id);if(!a)continue;const action=a.value,remark=r?.value.trim()||'',reduction=+red?.value||0;if(!gstImsActionAllowed(x,action)){notify('Invalid IMS action for '+x.invoiceNo);return}if((action==='Reject'||action==='Pending')&&!remark){notify('Remark required for '+x.invoiceNo);return}const tax=Math.abs((+x.igst||0)+(+x.cgst||0)+(+x.sgst||0));if(reduction>tax){notify('ITC reduction exceeds tax for '+x.invoiceNo);return}x.action=action;x.remark=remark;x.itcReduction=reduction;x.updatedAt=new Date().toISOString()}gstSaveIms(d);gstOpenIMS();}
function gstImsAdvisory(){feature('IMS Advisory','Services > Returns > IMS',`<div class="gst-alert info"><b>IMS training guidance</b><ul><li>Supplier records from GSTR-1, GSTR-1A and IFF are presented for recipient review.</li><li>Accept, Reject or Pending can be used where permitted.</li><li>From the October 2025 tax period, additional pending/ITC-reduction/remark capabilities apply to specified document types.</li><li>Import of Goods contains IMPG, IMPG Amendments, IMPGSEZ and IMPGSEZ Amendments concepts.</li><li>Changes are represented locally and do not communicate with GSTN.</li></ul></div><button class="gst-action secondary" onclick="gstOpenIMS()">BACK TO IMS</button>`)}
function gstImsDownload(){const d=gstImsData(),head=['Supplier GSTIN','Supplier Name','Invoice','Date','Type','Source','Taxable','IGST','CGST','SGST','Action','Remark','ITC Reduction'];const escCsv=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const csv=[head,...d.records.map(x=>[x.supplierGstin,x.supplierName,x.invoiceNo,x.invoiceDate,x.type,x.source,x.taxable,x.igst,x.cgst,x.sgst,x.action,x.remark,x.itcReduction])].map(r=>r.map(escCsv).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='IMS_'+gstReturnContext().period.replace(/\s+/g,'_')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function gstImsReset(){if(!confirm('Reset this period IMS demo records?'))return;localStorage.removeItem(gstImsKey());gstOpenIMS()}
function gstImsDraft2B(){
  const d=gstImsData(), accepted=d.records.filter(x=>(x.action==='Accept'||x.action==='No Action')&&x.itcEligible);const tot=accepted.reduce((z,x)=>{z.taxable+=+x.taxable||0;z.igst+=+x.igst||0;z.cgst+=+x.cgst||0;z.sgst+=+x.sgst||0;z.red+=+x.itcReduction||0;return z},{taxable:0,igst:0,cgst:0,sgst:0,red:0});
  feature('Draft GSTR-2B — IMS Generated','Services > Returns > IMS > Draft GSTR-2B',`<div class="gst-alert info">Draft GSTR-2B preview generated from current IMS actions for ${esc(gstReturnContext().period)}. The production GST system generates GSTR-2B according to its prescribed cycle; this page is a training simulation.</div><table class="gst-table"><tr><th>Records included</th><td>${accepted.length}</td><th>Taxable Value</th><td>${gstMoney(tot.taxable)}</td></tr><tr><th>IGST ITC</th><td>${gstMoney(tot.igst)}</td><th>CGST ITC</th><td>${gstMoney(tot.cgst)}</td></tr><tr><th>SGST ITC</th><td>${gstMoney(tot.sgst)}</td><th>Declared ITC Reduction</th><td>${gstMoney(tot.red)}</td></tr></table><div class="gst-section-title">Included Records</div><table class="gst-table"><thead><tr><th>Supplier</th><th>Invoice</th><th>Source</th><th>Action</th><th>Tax</th></tr></thead><tbody>${accepted.map(x=>`<tr><td>${esc(x.supplierGstin)}</td><td>${esc(x.invoiceNo)}</td><td>${esc(x.source)}</td><td>${esc(x.action)}</td><td>${gstMoney((+x.igst||0)+(+x.cgst||0)+(+x.sgst||0))}</td></tr>`).join('')||'<tr><td colspan="5">No accepted/no-action eligible records.</td></tr>'}</tbody></table><div class="gst-action-row"><button class="gst-action" onclick="gstOpenIMS()">BACK TO IMS</button></div>`)
}
/* ===== GSTR-2A — dynamic (continuously-updating) view of supplier-reported inward supplies ===== */
/* Unlike GSTR-2B (a static statement generated/locked for a period), GSTR-2A reflects every
   record a supplier has saved/filed so far — B2B, B2B Amendments, Credit/Debit Notes, and
   Import of Goods/SEZ — with no Accept/Reject workflow of its own (that's what IMS is for).
   It is read-only, for reconciliation against the purchase register, and is never used to
   auto-populate GSTR-3B (GSTR-2B is). It reuses the same underlying supplier-record feed as
   IMS/2B so every module in the simulator stays consistent with a single source of truth. */
function gst2ACategorize(x){
  if((x.source||'').toUpperCase()==='ISD') return /Amend/i.test(x.type||'')?'isdAmend':'isd';
  if(x.source==='Import of Goods') return /Amend/i.test(x.type||'')?'impgAmend':'impg';
  if(/Credit|Debit/.test(x.type||'')) return /Amend/i.test(x.type||'')?'cdnAmend':'cdn';
  return /Amend/i.test(x.type||'')?'b2bAmend':'b2b';
}
function gst2ABuild(){
  const rows=gstImsSyncSupplierRecords().records||[];
  const parts={b2b:[],b2bAmend:[],cdn:[],cdnAmend:[],isd:[],isdAmend:[],impg:[],impgAmend:[]};
  rows.forEach(x=>parts[gst2ACategorize(x)].push(x));
  const tax=x=>(+x.igst||0)+(+x.cgst||0)+(+x.sgst||0)+(+x.cess||0);
  const totals={};
  Object.keys(parts).forEach(k=>{totals[k]={count:parts[k].length,taxable:parts[k].reduce((s,x)=>s+(+x.taxable||0),0),tax:parts[k].reduce((s,x)=>s+tax(x),0)}});
  return {parts,totals,generatedAt:new Date().toISOString()};
}
function gst2ARows(list){
  return list.map(x=>{
    const tax=(+x.igst||0)+(+x.cgst||0)+(+x.sgst||0)+(+x.cess||0);
    return `<tr><td><b>${esc(x.supplierGstin)}</b><br><small>${esc(x.supplierName)}</small></td><td>${esc(x.invoiceNo)}<br><small>${esc(x.invoiceDate)}</small></td><td>${esc(x.type)}<br><small>${esc(x.source)}</small></td><td>${esc(x.pos||'-')}</td><td>${gstMoney(x.taxable)}</td><td>${gstMoney(tax)}</td><td><span class="gst-status ${x.itcEligible!==false?'green':'orange'}">${x.itcEligible!==false?'ITC Eligible':'ITC Ineligible'}</span></td></tr>`;
  }).join('')||'<tr><td colspan="7">No records reported by suppliers for this section yet.</td></tr>';
}
function gstOpenGstr2A(){
  if(!gstRequireLogin('GSTR-2A'))return;
  const ctx=gstReturnContext(), snap=gst2ABuild(), t=snap.totals;
  const section=(title,key,note)=>`<div class="gst-section-title">${title} <span class="gst-2a-count">(${t[key].count} record${t[key].count===1?'':'s'} &middot; taxable ${gstMoney(t[key].taxable)} &middot; tax ${gstMoney(t[key].tax)})</span></div>${note?`<div class="gst-note" style="margin:0 0 6px">${note}</div>`:''}<div class="gst-table-wrap"><table class="gst-table"><thead><tr><th>Supplier GSTIN / Name</th><th>Invoice / Date</th><th>Type / Source</th><th>Place of Supply</th><th>Taxable Value</th><th>Tax</th><th>ITC Status</th></tr></thead><tbody>${gst2ARows(snap.parts[key])}</tbody></table></div>`;
  feature('GSTR-2A — Auto-drafted ITC Statement (Dynamic)','Services > Returns > GSTR-2A',`
    <div class="gst-alert info"><b>GSTR-2A</b> is a dynamic, continuously-updating statement — it reflects every record your suppliers have saved or filed so far in ${esc(ctx.period)}, updated in real time. It is <b>view-only</b> and is <b>not</b> used to auto-populate GSTR-3B (GSTR-2B, the static monthly-locked statement, is used for that). Use GSTR-2A to reconcile against your purchase register.</div>
    <table class="gst-table"><tr><th>Financial Year</th><td>${esc(ctx.fy)}</td><th>Return Period</th><td>${esc(ctx.period)}</td></tr><tr><th>GSTIN</th><td>${esc(gstRead('gstTaxpayer',GST_DEMO).gstin)}</td><th>Last Refreshed</th><td>${new Date(snap.generatedAt).toLocaleString('en-IN')}</td></tr></table>
    <div class="gst-section-title">Part A — B2B Invoices</div>
    ${section('B2B Invoices','b2b')}
    ${section('B2B — Amendments','b2bAmend','Amendments to invoices reported by suppliers in a later period, mapped to the original invoice period.')}
    <div class="gst-section-title">Part B — Credit / Debit Notes</div>
    ${section('Credit / Debit Notes','cdn')}
    ${section('Credit / Debit Notes — Amendments','cdnAmend')}
    <div class="gst-section-title">Part C — ITC Received from Input Service Distributor (ISD)</div>
    ${section('ISD Credits','isd')}
    ${section('ISD — Amendments','isdAmend')}
    <div class="gst-section-title">Part D — Import of Goods / SEZ</div>
    ${section('Import of Goods from Overseas / SEZ (on Bill of Entry)','impg','Auto-populated from ICEGATE Bill of Entry data in the real portal; simulated here.')}
    ${section('Import of Goods — Amendments','impgAmend')}
    <div class="gst-action-row" style="flex-wrap:wrap"><button class="gst-action" onclick="gstOpenGstr2A()">REFRESH</button><button class="gst-action secondary" onclick="gst2ADownload()">DOWNLOAD EXCEL</button><button class="gst-action secondary" onclick="gstOpenIMS()">OPEN IMS (TAKE ACTION)</button><button class="gst-action secondary" onclick="gstOpenGstr2B()">VIEW GSTR-2B</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK TO RETURNS DASHBOARD</button></div>
    <div class="gst-note">Training simulator: GSTR-2A here is built from the same simulated supplier-invoice feed as IMS/GSTR-2B so all three stay consistent, the way the real GST system keeps them consistent from a single supplier-data source.</div>`);
}
function gst2ADownload(){
  const snap=gst2ABuild(),ctx=gstReturnContext();
  const head=['Section','Supplier GSTIN','Supplier Name','Invoice No','Invoice Date','Type','Source','Place of Supply','Taxable','IGST','CGST','SGST','Cess'];
  const escCsv=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const rows=[head];
  const labels={b2b:'B2B',b2bAmend:'B2B Amendment',cdn:'Credit/Debit Note',cdnAmend:'CDN Amendment',isd:'ISD Credit',isdAmend:'ISD Amendment',impg:'Import of Goods',impgAmend:'Import Amendment'};
  Object.keys(snap.parts).forEach(k=>snap.parts[k].forEach(x=>rows.push([labels[k],x.supplierGstin,x.supplierName,x.invoiceNo,x.invoiceDate,x.type,x.source,x.pos,x.taxable,x.igst,x.cgst,x.sgst,x.cess||0])));
  const csv=rows.map(r=>r.map(escCsv).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='GSTR2A_'+ctx.period.replace(/\s+/g,'_')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);
}
(function(){
  const _fn3=window.featureNav;
  window.featureNav=function(label){ if(label==='GSTR-2A'){ if(typeof window.gstRequireLogin==='function' && !window.gstRequireLogin(label)) return; return gstOpenGstr2A(); } return _fn3(label); };
  const _openReturn3=window.gstOpenReturn;
  window.gstOpenReturn=function(name){ if(name==='GSTR-2A') return gstOpenGstr2A(); return _openReturn3(name); };
  const _gstSearchReturns3=window.gstSearchReturns;
  window.gstSearchReturns=function(){
    _gstSearchReturns3();
    const box=document.getElementById('gstReturnResults'); if(!box) return;
    const period=document.getElementById('gstPeriod')?.value||'Jul 2026';
    const snap=gst2ABuild(); const totalRecords=Object.values(snap.totals).reduce((s,t)=>s+t.count,0);
    const wrap=document.createElement('div'); wrap.className='gst-return-tile'; wrap.style.marginTop='14px';
    wrap.innerHTML=`<div class="rt-head">GSTR-2A</div><div class="rt-body"><div class="rt-row"><span>Statement</span><b>Dynamic ITC statement (view only)</b></div><div class="rt-row"><span>Period</span><b>${esc(period)}</b></div><div class="rt-row"><span>Records so far</span><b>${totalRecords}</b></div><div class="rt-actions"><button class="gst-action" onclick="gstOpenGstr2A()">OPEN GSTR-2A</button></div></div>`;
    box.appendChild(wrap);
  };
})();

/* ===== GSTR-2B — official IMS-connected recipient ITC statement ===== */
function gst2BKey(){const c=gstReturnContext();return 'gstGstr2B_'+c.fy+'_'+c.period.replace(/[^A-Za-z0-9]/g,'_')}
function gst2BData(){return gstRead(gst2BKey(),{status:'Not Generated',generatedAt:null,recomputedAt:null,records:[],reconcile:{}})}
function gst2BIsQuarterly(){const p=gstRead('gstTaxpayer',GST_DEMO);return p.frequency==='Quarterly'}
function gst2BQuarterInfo(period){
  const m={'Jan 2026':'Q4 FY2025-26','Feb 2026':'Q4 FY2025-26','Mar 2026':'Q4 FY2025-26','Apr 2026':'Q1 FY2026-27','May 2026':'Q1 FY2026-27','Jun 2026':'Q1 FY2026-27','Jul 2026':'Q2 FY2026-27','Aug 2026':'Q2 FY2026-27','Sep 2026':'Q2 FY2026-27','Oct 2026':'Q3 FY2026-27','Nov 2026':'Q3 FY2026-27','Dec 2026':'Q3 FY2026-27'};
  return m[period]||'';
}
function gst2BSupplierFiledForSource(source){
  const c=gstReturnContext();
  if(source==='GSTR-1'){const g=gstRead('gstGstr1_'+c.fy+'_'+c.period.replace(/[^A-Za-z0-9]/g,'_'),null);return !!(g&&['Submitted','Filed'].includes(g.status));}
  if(source==='GSTR-1A'){const a=gstRead('gstGstr1A_'+c.fy+'_'+c.period.replace(/[^A-Za-z0-9]/g,'_'),null);return !!(a&&['Submitted','Filed'].includes(a.status));}
  return true;
}
function gst2BSourceRows(){
  const d=gstImsSyncSupplierRecords();
  return (d.records||[]).map(x=>({...x, action:x.action||'No Action', supplierFiled:x.supplierFiled!==false && (!x.sourceId || gst2BSupplierFiledForSource(x.source))}));
}
function gst2BBuildSnapshot(){
  const ctx=gstReturnContext(),rows=gst2BSourceRows(),p=gstRead('gstTaxpayer',GST_DEMO);
  const eligible=[],rejected=[],pending=[];
  rows.forEach(x=>{
    if(!x.supplierFiled)return;
    const action=x.action||'No Action';
    if(action==='Reject') rejected.push(x);
    else if(action==='Pending') pending.push(x);
    else if(action==='Accept'||action==='No Action') eligible.push(x);
  });
  const tax=x=>({igst:+x.igst||0,cgst:+x.cgst||0,sgst:+x.sgst||0,cess:+x.cess||0,total:(+x.igst||0)+(+x.cgst||0)+(+x.sgst||0)+(+x.cess||0)});
  const sum=list=>list.reduce((z,x)=>{const t=tax(x);z.taxable+=(+x.taxable||0);z.igst+=t.igst;z.cgst+=t.cgst;z.sgst+=t.sgst;z.cess+=t.cess;z.total+=t.total;z.reduction+=Math.max(0,+x.itcReduction||0);return z},{taxable:0,igst:0,cgst:0,sgst:0,cess:0,total:0,reduction:0});
  const a=sum(eligible),r=sum(rejected),pen=sum(pending);
  a.net=a.total-a.reduction;
  return {status:'Generated',generatedAt:new Date().toISOString(),fy:ctx.fy,period:ctx.period,frequency:p.frequency,quarter:gst2BIsQuarterly()?gst2BQuarterInfo(ctx.period):'',records:eligible,rejected,pending,summary:{available:a,rejected:r,pending:pen},recomputedAt:new Date().toISOString()};
}
function gst2BPreviousPeriodReady(){
  const c=gstReturnContext();
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const m=(c.period||'').slice(0,3); const idx=months.indexOf(m);
  if(idx<0) return true;
  const prev=new Date(2026,idx-1,1);
  const prevPeriod=months[prev.getMonth()]+' '+prev.getFullYear();
  const prevKey='gstGstr3B_'+c.fy+'_'+prevPeriod.replace(/[^A-Za-z0-9]/g,'_');
  const d=gstRead(prevKey,null);
  return !!(d&&['Filed','Filed Successfully'].includes(d.status));
}
function gst2BQuarterMonthStatus(period){
  const m=(period||'').slice(0,3);
  return ['Jul','Aug','Oct','Nov','Jan','Feb','Apr','May'].includes(m)?'M1/M2':'M3';
}
function gst2BGenerationAllowed(){
  const p=gstRead('gstTaxpayer',GST_DEMO), c=gstReturnContext();
  if(p.frequency==='Quarterly' && gst2BQuarterMonthStatus(c.period)!=='M3') return {ok:false,reason:'For QRMP taxpayers, the quarterly GSTR-2B is represented for the quarter after M3; M1/M2 do not have a separate GSTR-2B.'};
  if(!gst2BPreviousPeriodReady()) return {ok:false,reason:'GSTR-2B for this period is available only after the previous period\'s GSTR-3B is filed in this training simulator.'};
  return {ok:true};
}
function gst2BGenerate(recompute=true){
  if(!gstRequireLogin('GSTR-2B'))return null;
  const gate=gst2BGenerationAllowed();
  if(!gate.ok){notify(gate.reason);return gst2BData();}
  if(gstGstr3BFiledForPeriod && gstGstr3BFiledForPeriod()){
    notify('GSTR-2B cannot be recomputed after GSTR-3B is filed for this period.');return gst2BData();
  }
  const snap=gst2BBuildSnapshot();
  gstWrite(gst2BKey(),snap);
  return snap;
}
function gst2BActionClass(a){return a==='Accepted'||a==='No Action'?'green':a==='Rejected'?'orange':a==='Pending'?'blue':''}
function gst2BCategory(x){
  if(x.source==='Import of Goods')return 'Imports';
  if(/Credit|Debit/.test(x.type||''))return 'Credit/Debit Notes';
  return 'B2B';
}
function gst2BRecomputeRequired(){
  const d=gst2BData();
  if(d.status!=='Generated')return true;
  const ims=gstImsData();
  return new Date(ims.updatedAt||0)>new Date(d.generatedAt||0);
}
function gst2BRecomputeAndOpen(){gst2BGenerate(true);gstOpenGstr2B()}
function gstOpenGstr2B(){
  if(!gstRequireLogin('GSTR-2B'))return;
  const c=gstReturnContext(),p=gstRead('gstTaxpayer',GST_DEMO),d=gst2BData(),need=gst2BRecomputeRequired();
  feature('GSTR-2B — Auto-drafted ITC Statement','Services > Returns > GSTR-2B',gstGstr2BBody(c,p,d,need));
}
function gstGstr2BBody(c,p,d,need){
  const q=gst2BIsQuarterly(), summary=d.summary||{available:{},rejected:{},pending:{}};
  const a=summary.available||{},r=summary.rejected||{},pen=summary.pending||{};
  const recs=d.records||[],rej=d.rejected||[],pending=d.pending||[];
  const all=[...recs.map(x=>({...x,_bucket:'ITC Available'})),...rej.map(x=>({...x,_bucket:'ITC Not Available'})),...pending.map(x=>({...x,_bucket:'Pending / Not in 2B'}))];
  const tax=x=>({igst:+x.igst||0,cgst:+x.cgst||0,sgst:+x.sgst||0,cess:+x.cess||0,total:(+x.igst||0)+(+x.cgst||0)+(+x.sgst||0)+(+x.cess||0)});
  const secRows=(list,empty='No records available.')=>list.map(x=>{const t=tax(x);return `<tr><td>${esc(x.supplierGstin||'')}</td><td>${esc(x.invoiceNo||'')}<br><small>${esc(x.invoiceDate||'')}</small></td><td>${esc(x.supplierName||'')}</td><td>${gstMoney(x.taxable)}</td><td>${gstMoney(t.igst)}</td><td>${gstMoney(t.cgst)}</td><td>${gstMoney(t.sgst)}</td><td>${gstMoney(t.cess)}</td><td>${gstMoney(x.itcReduction||0)}</td><td>${esc(x.source||'')}</td></tr>`}).join('')||`<tr><td colspan="10">${empty}</td></tr>`;
  const availA=recs.filter(x=>gst2BCategory(x)!=='Credit/Debit Notes' && x.source!=='Import of Goods');
  const availISD=recs.filter(x=>(x.source||'').toUpperCase().includes('ISD'));
  const availRCM=recs.filter(x=>(x.reverseCharge===true||x.reverseCharge==='Y'||x.reverseCharge==='Yes') && x.source!=='Import of Goods');
  const imports=recs.filter(x=>x.source==='Import of Goods');
  const notes=recs.filter(x=>gst2BCategory(x)==='Credit/Debit Notes');
  const notAvail=rej;
  const availableNet=Math.max(0,(a.total||0)-(a.reduction||0));
  const gate=gst2BGenerationAllowed();
  const generated=d.status==='Generated';
  return `<div class="gst-alert info"><b>GSTR-2B — Auto-drafted ITC Statement</b><br>System-generated statement of input tax credit based on eligible supplier filings, IMS actions and import data. This training simulator uses local demo data only.</div>
  <div class="gst-breadcrumb">Dashboard &gt; Returns &gt; GSTR-2B</div>
  <div class="gst-section-title">GSTR-2B — Auto-drafted ITC Statement</div>
  <table class="gst-table"><tr><th>GSTIN</th><td>${esc(p.gstin||GST_DEMO.gstin)}</td><th>Legal Name</th><td>${esc(p.legalName||GST_DEMO.legalName)}</td></tr><tr><th>Financial Year</th><td>${esc(c.fy)}</td><th>Return Period</th><td>${esc(c.period)}</td></tr><tr><th>Taxpayer Type</th><td>${esc(p.taxpayerType||'Regular')}</td><th>Frequency</th><td>${esc(p.frequency||'Monthly')}</td></tr><tr><th>Statement</th><td>${q?'<b>Quarterly GSTR-2BQ</b>':'<b>Monthly GSTR-2B</b>'}</td><th>Status</th><td><span class="gst-status ${generated?'green':'orange'}">${generated?'Generated':'Not Generated'}</span></td></tr></table>
  ${!gate.ok&&!generated?`<div class="gst-alert warning"><b>Generation condition:</b> ${esc(gate.reason)}</div>`:''}
  ${q?`<div class="gst-alert warning"><b>QRMP:</b> The quarterly statement consolidates the quarter's eligible data. M1/M2 are not separate GSTR-2B statements; the quarterly statement is represented here as GSTR-2BQ.</div>`:''}
  ${need&&generated?`<div class="gst-alert warning"><b>Re-computation required.</b> IMS actions changed after the last GSTR-2B generation. Recompute before using the updated ITC values for GSTR-3B.</div>`:''}
  <div class="gst-action-row" style="flex-wrap:wrap"><button class="gst-action" onclick="gst2BRecomputeAndOpen()">${generated?'RECOMPUTE GSTR-2B':'GENERATE GSTR-2B'}</button><button class="gst-action secondary" onclick="gst2BDownload()">DOWNLOAD GSTR-2B</button><button class="gst-action secondary" onclick="gst2BReconcile()">RECONCILE WITH BOOKS</button><button class="gst-action secondary" onclick="gstImsAdvisory()">VIEW IMS RULES</button><button class="gst-action secondary" onclick="gstOpenIMS()">BACK TO IMS</button></div>
  <div class="gst-section-title">Table 3 — ITC Available Summary</div>
  <table class="gst-table"><thead><tr><th>Part / Section</th><th>Nature of Supplies</th><th>IGST</th><th>CGST</th><th>SGST/UTGST</th><th>Cess</th><th>Total ITC</th></tr></thead><tbody>
  <tr><td>Part A - I</td><td>All other ITC - Supplies from registered persons other than reverse charge</td><td>${gstMoney(a.igst||0)}</td><td>${gstMoney(a.cgst||0)}</td><td>${gstMoney(a.sgst||0)}</td><td>${gstMoney(a.cess||0)}</td><td><b>${gstMoney(availableNet)}</b></td></tr>
  <tr><td>Part A - II</td><td>Inward Supplies from ISD</td><td>${gstMoney(availISD.reduce((s,x)=>s+(+x.igst||0),0))}</td><td>${gstMoney(availISD.reduce((s,x)=>s+(+x.cgst||0),0))}</td><td>${gstMoney(availISD.reduce((s,x)=>s+(+x.sgst||0),0))}</td><td>${gstMoney(availISD.reduce((s,x)=>s+(+x.cess||0),0))}</td><td>${gstMoney(availISD.reduce((s,x)=>s+tax(x).total,0))}</td></tr>
  <tr><td>Part A - III</td><td>Inward Supplies liable for Reverse Charge</td><td>${gstMoney(availRCM.reduce((s,x)=>s+(+x.igst||0),0))}</td><td>${gstMoney(availRCM.reduce((s,x)=>s+(+x.cgst||0),0))}</td><td>${gstMoney(availRCM.reduce((s,x)=>s+(+x.sgst||0),0))}</td><td>${gstMoney(availRCM.reduce((s,x)=>s+(+x.cess||0),0))}</td><td>${gstMoney(availRCM.reduce((s,x)=>s+tax(x).total,0))}</td></tr>
  <tr><td>Part A - IV</td><td>Import of Goods</td><td>${gstMoney(imports.reduce((s,x)=>s+(+x.igst||0),0))}</td><td>${gstMoney(imports.reduce((s,x)=>s+(+x.cgst||0),0))}</td><td>${gstMoney(imports.reduce((s,x)=>s+(+x.sgst||0),0))}</td><td>${gstMoney(imports.reduce((s,x)=>s+(+x.cess||0),0))}</td><td>${gstMoney(imports.reduce((s,x)=>s+tax(x).total,0))}</td></tr>
  <tr><td>Part B - I</td><td>Others — Credit/Debit Notes and amendments</td><td>${gstMoney(notes.reduce((s,x)=>s+(+x.igst||0),0))}</td><td>${gstMoney(notes.reduce((s,x)=>s+(+x.cgst||0),0))}</td><td>${gstMoney(notes.reduce((s,x)=>s+(+x.sgst||0),0))}</td><td>${gstMoney(notes.reduce((s,x)=>s+(+x.cess||0),0))}</td><td>${gstMoney(notes.reduce((s,x)=>s+tax(x).total,0))}</td></tr>
  </tbody></table>
  <div class="gst-section-title">Table 4 — ITC Not Available</div>
  <table class="gst-table"><thead><tr><th>Category</th><th>Records</th><th>IGST</th><th>CGST</th><th>SGST/UTGST</th><th>Cess</th><th>Total</th></tr></thead><tbody><tr><td>ITC Not Available / Rejected in IMS</td><td>${notAvail.length}</td><td>${gstMoney(r.igst||0)}</td><td>${gstMoney(r.cgst||0)}</td><td>${gstMoney(r.sgst||0)}</td><td>${gstMoney(r.cess||0)}</td><td>${gstMoney(r.total||0)}</td></tr></tbody></table>
  <div class="gst-section-title">Statement Summary</div>
  <table class="gst-table"><tr><th>Total Records in ITC Available</th><td>${recs.length}</td><th>Total ITC Available</th><td><b>${gstMoney(availableNet)}</b></td></tr><tr><th>ITC Reduction</th><td>${gstMoney(a.reduction||0)}</td><th>ITC Not Available</th><td>${gstMoney(r.total||0)}</td></tr><tr><th>Pending / Excluded</th><td>${pending.length}</td><th>Generated On</th><td>${d.generatedAt?esc(new Date(d.generatedAt).toLocaleString('en-IN')):'Not generated'}</td></tr></table>
  <div class="gst-section-title">Document-wise Details</div>
  <table class="gst-table"><thead><tr><th>Supplier GSTIN</th><th>Invoice / Date</th><th>Supplier</th><th>Taxable Value</th><th>IGST</th><th>CGST</th><th>SGST/UTGST</th><th>Cess</th><th>ITC Reduction</th><th>Source</th></tr></thead><tbody>${secRows(all)}</tbody></table>
  <div class="gst-alert warning"><b>Important:</b> GSTR-2B is a static statement for the relevant return period. Taxpayers should reconcile it with their books and ensure ITC is not availed twice. ITC not available in Table 4 should not be entered in the eligible ITC portion of GSTR-3B.</div>`;
}
function gst2BReconcile(){
  const d=gst2BData();
  if(d.status!=='Generated'){
    const g=gst2BGenerate(true);
    // Bug fix: this used to unconditionally recurse into gst2BReconcile() again after
    // trying to generate, with no check on whether generation actually succeeded. If
    // generation is blocked (e.g. the previous period's GSTR-3B hasn't been filed yet,
    // which this simulator correctly requires), status never becomes 'Generated' and
    // the function called itself forever — an infinite recursion that crashes the page.
    if(!g||g.status!=='Generated'){
      const gate=(typeof gst2BGenerationAllowed==='function')?gst2BGenerationAllowed():{ok:false,reason:'GSTR-2B has not been generated for this period yet.'};
      feature('GSTR-2B — ITC Reconciliation','Returns > GSTR-2B > Reconciliation',`<div class="gst-alert warning"><b>GSTR-2B has not been generated for this period yet.</b><br>${esc(gate.reason||'Generate GSTR-2B first, then reconcile.')}</div><div class="gst-action-row"><button class="gst-action secondary" onclick="gstOpenGstr2B()">BACK TO GSTR-2B</button></div>`);
      return;
    }
    return gst2BReconcileRender(g);
  }
  return gst2BReconcileRender(d);
}
function gst2BReconcileRender(d){
  const records=[...(d.records||[]),...(d.rejected||[]),...(d.pending||[])], saved=d.reconcile||{};
  const rows=records.map(x=>{const st=saved[x.id]||'Not Reconciled';return `<tr><td>${esc(x.supplierGstin)}</td><td>${esc(x.invoiceNo)}</td><td>${gstMoney(x.taxable)}</td><td>${gstMoney((+x.igst||0)+(+x.cgst||0)+(+x.sgst||0))}</td><td><select id="r2bRec_${esc(x.id)}" class="f-select"><option ${st==='Not Reconciled'?'selected':''}>Not Reconciled</option><option ${st==='Matched'?'selected':''}>Matched</option><option ${st==='Mismatch'?'selected':''}>Mismatch</option><option ${st==='Not in Books'?'selected':''}>Not in Books</option></select></td></tr>`}).join('')||'<tr><td colspan="5">No records.</td></tr>';
  feature('GSTR-2B — ITC Reconciliation','Returns > GSTR-2B > Reconciliation',`<div class="gst-alert info"><b>Training reconciliation workspace.</b> Compare GSTR-2B documents against simulated purchase records/books. This does not alter the GSTN statement.</div><table class="gst-table"><thead><tr><th>Supplier</th><th>Invoice</th><th>Taxable</th><th>Tax</th><th>Reconciliation Status</th></tr></thead><tbody>${rows}</tbody></table><div class="gst-action-row"><button class="gst-action" onclick="gst2BSaveReconcile()">SAVE RECONCILIATION</button><button class="gst-action secondary" onclick="gstOpenGstr2B()">BACK TO GSTR-2B</button></div><div id="gst2BRecMsg" class="demo-note"></div>`)
}
function gst2BSaveReconcile(){
  const d=gst2BData(), rec=[...(d.records||[]),...(d.rejected||[]),...(d.pending||[])];d.reconcile=d.reconcile||{};
  rec.forEach(x=>{const e=document.getElementById('r2bRec_'+x.id);if(e){d.reconcile[x.id]=e.value;x.reconcileStatus=e.value}});d.reconciledAt=new Date().toISOString();gstWrite(gst2BKey(),d);const m=document.getElementById('gst2BRecMsg');if(m)m.innerHTML='<span style="color:#176b35"><b>Reconciliation saved successfully.</b></span>';setTimeout(gstOpenGstr2B,350)
}
function gst2BDownload(){
  const d=gst2BData(), rows=[...(d.records||[]),...(d.rejected||[]),...(d.pending||[])], head=['Supplier GSTIN','Supplier','Invoice','Date','Category','Source','Taxable','IGST','CGST','SGST','Cess','ITC Reduction','IMS Action','2B Treatment','Reconciliation'];
  const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const csv=[head,...rows.map(x=>[x.supplierGstin,x.supplierName,x.invoiceNo,x.invoiceDate,gst2BCategory(x),x.source,x.taxable,x.igst,x.cgst,x.sgst,x.cess||0,x.itcReduction||0,x.action,x._bucket||'',x.reconcileStatus||'Not Reconciled'])].map(r=>r.map(q).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='GSTR-2B_'+gstReturnContext().period.replace(/\s+/g,'_')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)
}
/* Connect the exact existing portal navigation to GSTR-2B without changing its visual shell. */
const _gstFeature2B=feature;
feature=function(title,sub,body){_gstFeature2B(title,sub,body);document.querySelectorAll('#featureBody .gst-side-group').forEach(g=>{const h=g.querySelector('h4');if(h&&h.textContent.trim()==='Returns'&&!g.querySelector('[data-gstr2b-link]')){const a=document.createElement('a');a.setAttribute('data-gstr2b-link','1');a.textContent='GSTR-2B';a.onclick=()=>gstOpenGstr2B();g.appendChild(a)}})};
const _gstOpenReturn2B=window.gstOpenReturn;
window.gstOpenReturn=function(name){if(name==='GSTR-2B')return gstOpenGstr2B();return _gstOpenReturn2B(name)};
const _gstFeatureNav2B=featureNav;
featureNav=function(label){if(label==='GSTR-2B')return gstOpenGstr2B();return _gstFeatureNav2B(label)};
const _gstSearchReturns2B=gstSearchReturns;
gstSearchReturns=function(){_gstSearchReturns2B();const box=document.getElementById('gstReturnResults');if(!box)return;const fy=document.getElementById('gstFY')?.value||'2026-27',period=document.getElementById('gstPeriod')?.value||'Jul 2026',p=gstRead('gstTaxpayer',GST_DEMO);const d=gst2BData();const q=p.frequency==='Quarterly';const wrap=document.createElement('div');wrap.className='gst-return-tile';wrap.style.marginTop='14px';wrap.innerHTML=`<div class="rt-head">${q?'GSTR-2BQ':'GSTR-2B'}</div><div class="rt-body"><div class="rt-row"><span>Statement</span><b>${q?'Quarterly ITC statement':'Auto-drafted ITC statement'}</b></div><div class="rt-row"><span>Period</span><b>${esc(period)}</b></div><div class="rt-row"><span>Status</span><b>${esc(d.status||'Not Generated')}</b></div><div class="rt-actions"><button class="gst-action" onclick="gstOpenGstr2B()">OPEN ${q?'GSTR-2BQ':'GSTR-2B'}</button><button class="gst-action secondary" onclick="gst2BRecomputeAndOpen()">RECOMPUTE</button></div></div>`;box.appendChild(wrap)};
/* Replace the former draft preview action with the complete GSTR-2B workspace. */
gstImsDraft2B=function(){gstOpenGstr2B()};

/* ===== GSTR-3B — connected filing/payment/offset workflow ===== */
function gst3bKey(){const c=gstReturnContext();return 'gstGstr3B_'+c.fy+'_'+c.period.replace(/[^A-Za-z0-9]/g,'_')}
function gst3bDefault(){return {status:'Draft',autoPopulated:false,savedAt:null,validatedAt:null,filedAt:null,reference:null,system:{a:{taxable:0,igst:0,cgst:0,sgst:0,cess:0},b:{taxable:0,igst:0,cess:0},c:{taxable:0,igst:0,cgst:0,sgst:0,cess:0},d:{taxable:0,igst:0,cgst:0,sgst:0,cess:0},e:{taxable:0,igst:0,cgst:0,sgst:0,cess:0},itc:{igst:0,cgst:0,sgst:0,cess:0}},input:{a:{taxable:0,igst:0,cgst:0,sgst:0,cess:0},b:{taxable:0,igst:0,cess:0},c:{taxable:0,igst:0,cgst:0,sgst:0,cess:0},d:{taxable:0,igst:0,cgst:0,sgst:0,cess:0},e:{taxable:0,igst:0,cgst:0,sgst:0,cess:0},rcm:{igst:0,cgst:0,sgst:0,cess:0},itcA:{igst:0,cgst:0,sgst:0,cess:0},itcB:{igst:0,cgst:0,sgst:0,cess:0},other:{igst:0,cgst:0,sgst:0,cess:0},interest:{igst:0,cgst:0,sgst:0,cess:0},lateFee:{igst:0,cgst:0,sgst:0,cess:0},penalty:{igst:0,cgst:0,sgst:0,cess:0},otherLiability:{igst:0,cgst:0,sgst:0,cess:0}},payment:{creditUsed:0,cashUsed:0,reference:null},audit:[]}}
function gst3bData(){return gstRead(gst3bKey(),gst3bDefault())}
function gst3bSave(d){gstWrite(gst3bKey(),d)}
function gst3bNum(v){const n=Number(v);return Number.isFinite(n)&&n>=0?n:0}
function gst3bSum(o){return ['igst','cgst','sgst','cess'].reduce((z,k)=>z+gst3bNum(o&&o[k]),0)}
function gst3bGstr1Source(){const c=gstReturnContext();return gstRead('gstGstr1_'+c.fy+'_'+c.period.replace(/[^A-Za-z0-9]/g,'_'),null)}
function gst3bGstr1Totals(){const g=gst3bGstr1Source(),z={a:{taxable:0,igst:0,cgst:0,sgst:0,cess:0},b:{taxable:0,igst:0,cess:0},c:{taxable:0,igst:0,cgst:0,sgst:0,cess:0},d:{taxable:0,igst:0,cgst:0,sgst:0,cess:0},e:{taxable:0,igst:0,cgst:0,sgst:0,cess:0}};if(!g)return z;const add=(x,k)=>{z[k].taxable+=gst3bNum(x.taxable);z[k].igst+=gst3bNum(x.igst);z[k].cgst+=gst3bNum(x.cgst);z[k].sgst+=gst3bNum(x.sgst);z[k].cess+=gst3bNum(x.cess)};(g.invoices||[]).forEach(x=>add(x,'a'));(g.b2c||[]).forEach(x=>x.type==='Nil / Exempt / Non-GST'?add(x,'c'):add(x,'a'));(g.exports||[]).forEach(x=>add(x,'b'));return z}
function gst3bGstr2bTotals(){const d=gst2BData(),a=d.summary&&d.summary.available||{};if(d.status!=='Generated')return {igst:0,cgst:0,sgst:0,cess:0};let r=gst3bNum(a.reduction),v={igst:gst3bNum(a.igst),cgst:gst3bNum(a.cgst),sgst:gst3bNum(a.sgst),cess:gst3bNum(a.cess)};for(const h of ['igst','cgst','sgst','cess']){const cut=Math.min(v[h],r);v[h]-=cut;r-=cut}return v}
function gst3bAutoPopulate(d){const s=gst3bGstr1Totals(),itc=gst3bGstr2bTotals();d.system={...s,itc};if(d.status==='Draft'||!d.savedAt){d.input.a=JSON.parse(JSON.stringify(s.a));d.input.b=JSON.parse(JSON.stringify(s.b));d.input.c=JSON.parse(JSON.stringify(s.c));d.input.d=JSON.parse(JSON.stringify(s.d));d.input.e=JSON.parse(JSON.stringify(s.e));d.input.itcA={...itc};d.autoPopulated=true}return d}
function gst3bReadInputs(d){for(const g of ['a','b','c','d','e']){d.input[g]=d.input[g]||{};const t=document.getElementById('g3b_'+g+'_taxable');if(t)d.input[g].taxable=gst3bNum(t.value);for(const h of ['igst','cgst','sgst','cess']){const e=document.getElementById('g3b_'+g+'_'+h);if(e)d.input[g][h]=gst3bNum(e.value)}}for(const g of ['rcm','itcA','itcB','other','interest','lateFee','penalty','otherLiability']){d.input[g]=d.input[g]||{};for(const h of ['igst','cgst','sgst','cess']){const e=document.getElementById('g3b_'+g+'_'+h);if(e)d.input[g][h]=gst3bNum(e.value)}}}
function gst3bLiability(d){const out={igst:0,cgst:0,sgst:0,cess:0};for(const g of ['a','b','c','d','e','rcm','otherLiability'])for(const h of Object.keys(out))out[h]+=gst3bNum(d.input[g]&&d.input[g][h]);const itc={};for(const h of Object.keys(out))itc[h]=Math.max(0,gst3bNum(d.input.itcA&&d.input.itcA[h])-gst3bNum(d.input.itcB&&d.input.itcB[h])+gst3bNum(d.input.other&&d.input.other[h]));const net={};for(const h of Object.keys(out))net[h]=Math.max(0,out[h]-itc[h]);const charges={};for(const h of Object.keys(out))charges[h]=gst3bNum(d.input.interest&&d.input.interest[h])+gst3bNum(d.input.lateFee&&d.input.lateFee[h])+gst3bNum(d.input.penalty&&d.input.penalty[h]);return {out,itc,net,charges,total:gst3bSum(net)+gst3bSum(charges)}}
function gst3bSectionRow(title,key,d){return '<tr><th>'+title+'</th><td><input class="f-input" id="g3b_'+key+'_taxable" type="number" min="0" step="0.01" value="'+gst3bNum(d.input[key].taxable)+'"></td><td><input class="f-input" id="g3b_'+key+'_igst" type="number" min="0" step="0.01" value="'+gst3bNum(d.input[key].igst)+'"></td><td><input class="f-input" id="g3b_'+key+'_cgst" type="number" min="0" step="0.01" value="'+gst3bNum(d.input[key].cgst)+'"></td><td><input class="f-input" id="g3b_'+key+'_sgst" type="number" min="0" step="0.01" value="'+gst3bNum(d.input[key].sgst)+'"></td><td><input class="f-input" id="g3b_'+key+'_cess" type="number" min="0" step="0.01" value="'+gst3bNum(d.input[key].cess)+'"></td></tr>'}
function gst3bOpen(){if(!gstRequireLogin('GSTR-3B'))return;const d=gst3bAutoPopulate(gst3bData());gst3bSave(d);feature('GSTR-3B — Summary Return','Services > Returns > Returns Dashboard > GSTR-3B',gst3bBody(d))}
function gst3bBody(d){const c=gstReturnContext(),g=gst3bGstr1Source(),b=gst2BData(),l=gst3bLiability(d);return '<div class="gst-dash-head"><h2>GSTR-3B — Summary Return</h2><div class="gst-dash-meta"><span>Financial Year: <b>'+esc(c.fy)+'</b></span><span>Return Period: <b>'+esc(c.period)+'</b></span><span>GSTIN: <b>'+esc(gstRead('gstTaxpayer',GST_DEMO).gstin)+'</b></span><span>Status: <b>'+esc(d.status)+'</b></span></div></div><div class="gst-alert info"><b>System-generated assistance:</b> GSTR-3B is assisted by filed GSTR-1 and generated GSTR-2B data. Values are editable locally for training and must be reviewed before filing.</div><div class="gst-alert '+((g&&['Submitted','Filed'].includes(g.status))?'success':'warning')+'"><b>GSTR-1:</b> '+esc(g&&g.status||'Not filed')+'</div><div class="gst-alert '+(b.status==='Generated'?'success':'warning')+'"><b>GSTR-2B:</b> '+esc(b.status||'Not generated')+'</div><div class="gst-section-title">Return Preparation</div><div class="gst-tile-grid"><div class="gst-return-tile"><div class="rt-head">3.1 Outward Supplies</div><div class="rt-body"><div class="rt-row"><span>Tables 3.1(a)-(e)</span><b>Review / Edit</b></div><div class="rt-actions"><button class="gst-action" onclick="gst3bOpenOutward()">OPEN</button></div></div></div><div class="gst-return-tile"><div class="rt-head">3.2 Inter-State Supplies</div><div class="rt-body"><div class="rt-row"><span>POS-wise details</span><b>Applicable supplies</b></div><div class="rt-actions"><button class="gst-action" onclick="gst3bOpen32()">OPEN</button></div></div></div><div class="gst-return-tile"><div class="rt-head">4 Eligible ITC</div><div class="rt-body"><div class="rt-row"><span>ITC Available / Reversal</span><b>GSTR-2B assisted</b></div><div class="rt-actions"><button class="gst-action" onclick="gst3bOpenITC()">OPEN</button></div></div></div><div class="gst-return-tile"><div class="rt-head">5 Exempt / Nil / Non-GST</div><div class="rt-body"><div class="rt-row"><span>Inward supplies</span><b>Summary</b></div><div class="rt-actions"><button class="gst-action" onclick="gst3bOpen5()">OPEN</button></div></div></div></div><div class="gst-section-title">Liability Summary</div><table class="gst-table"><thead><tr><th>Particular</th><th>IGST</th><th>CGST</th><th>SGST/UTGST</th><th>Cess</th><th>Total</th></tr></thead><tbody><tr><td>Output + RCM + Other Liability</td><td>'+gstMoney(l.out.igst)+'</td><td>'+gstMoney(l.out.cgst)+'</td><td>'+gstMoney(l.out.sgst)+'</td><td>'+gstMoney(l.out.cess)+'</td><td>'+gstMoney(gst3bSum(l.out))+'</td></tr><tr><td>Eligible ITC after reversals</td><td>'+gstMoney(l.itc.igst)+'</td><td>'+gstMoney(l.itc.cgst)+'</td><td>'+gstMoney(l.itc.sgst)+'</td><td>'+gstMoney(l.itc.cess)+'</td><td>'+gstMoney(gst3bSum(l.itc))+'</td></tr><tr><td><b>Net Tax + Charges Payable</b></td><td><b>'+gstMoney(l.net.igst+l.charges.igst)+'</b></td><td><b>'+gstMoney(l.net.cgst+l.charges.cgst)+'</b></td><td><b>'+gstMoney(l.net.sgst+l.charges.sgst)+'</b></td><td><b>'+gstMoney(l.net.cess+l.charges.cess)+'</b></td><td><b>'+gstMoney(l.total)+'</b></td></tr></tbody></table><div class="gst-section-title">Actions</div><div class="gst-action-row" style="flex-wrap:wrap"><button class="gst-action" onclick="gst3bAutoSave()">AUTO-POPULATE / SAVE</button><button class="gst-action secondary" onclick="gst3bSystemSummary()">SYSTEM GENERATED SUMMARY</button><button class="gst-action secondary" onclick="gst3bPreview()">PREVIEW</button><button class="gst-action" onclick="gst3bValidate()">VALIDATE</button><button class="gst-action" onclick="gst3bPayment()">PROCEED TO PAYMENT</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK</button></div><div id="gst3bMsg" class="demo-note"></div>'}
function gst3bAutoSave(){const d=gst3bAutoPopulate(gst3bData());gst3bReadInputs(d);d.status='Saved';d.savedAt=new Date().toISOString();d.audit.push({at:d.savedAt,action:'SAVE GSTR-3B'});gst3bSave(d);gst3bOpen()}
function gst3bOpenOutward(){const d=gst3bAutoPopulate(gst3bData());gst3bSave(d);feature('GSTR-3B — Table 3.1 Outward Supplies','GSTR-3B > 3.1', '<div class="gst-alert info">Review the system-assisted values and save the return. Tables 3.1(a)-(e) are represented below.</div><div class="gst-table-wrap"><table class="gst-table"><thead><tr><th>Table</th><th>Taxable Value</th><th>IGST</th><th>CGST</th><th>SGST/UTGST</th><th>Cess</th></tr></thead><tbody>'+gst3bSectionRow('3.1(a) Outward taxable supplies','a',d)+gst3bSectionRow('3.1(b) Zero rated supplies','b',d)+gst3bSectionRow('3.1(c) Nil / exempt supplies','c',d)+gst3bSectionRow('3.1(d) Reverse charge supplies','d',d)+gst3bSectionRow('3.1(e) Non-GST supplies','e',d)+'</tbody></table></div><div class="gst-action-row"><button class="gst-action" onclick="gst3bSaveSection(\'outward\')">SAVE GSTR-3B</button><button class="gst-action secondary" onclick="gst3bOpen()">BACK</button></div><div id="gst3bSectionMsg" class="demo-note"></div>')}
function gst3bOpen32(){const d=gst3bData();feature('GSTR-3B — Table 3.2 Inter-State Supplies','GSTR-3B > 3.2','<div class="gst-alert info">Enter inter-state supplies made to unregistered persons, composition taxable persons and UIN holders, where applicable.</div><div class="gst-form-grid"><div><label>Unregistered Persons</label><input id="g3b32unreg" class="f-input" type="number" min="0" value="'+gst3bNum(d.input.t32unreg)+'"></div><div><label>Composition Taxable Persons</label><input id="g3b32comp" class="f-input" type="number" min="0" value="'+gst3bNum(d.input.t32comp)+'"></div><div><label>UIN Holders</label><input id="g3b32uin" class="f-input" type="number" min="0" value="'+gst3bNum(d.input.t32uin)+'"></div></div><div class="gst-action-row"><button class="gst-action" onclick="gst3bSave32()">SAVE</button><button class="gst-action secondary" onclick="gst3bOpen()">BACK</button></div><div id="gst3bSectionMsg" class="demo-note"></div>')}
function gst3bOpenITC(){const d=gst3bAutoPopulate(gst3bData());gst3bSave(d);feature('GSTR-3B — Table 4 Eligible ITC','GSTR-3B > 4','<div class="gst-alert info">Eligible ITC is assisted from generated GSTR-2B. Review reversals and other adjustments before saving.</div><div class="gst-table-wrap"><table class="gst-table"><thead><tr><th>Component</th><th>IGST</th><th>CGST</th><th>SGST/UTGST</th><th>Cess</th></tr></thead><tbody><tr><th>4A(5) All other ITC</th>'+gst3bInputCells('itcA',d.input.itcA)+'</tr><tr><th>4B ITC Reversed</th>'+gst3bInputCells('itcB',d.input.itcB)+'</tr><tr><th>Other ITC adjustment</th>'+gst3bInputCells('other',d.input.other)+'</tr></tbody></table></div><div class="gst-action-row"><button class="gst-action" onclick="gst3bSaveITC()">SAVE</button><button class="gst-action secondary" onclick="gstOpenGstr2B()">VIEW GSTR-2B</button><button class="gst-action secondary" onclick="gst3bOpen()">BACK</button></div><div id="gst3bSectionMsg" class="demo-note"></div>')}
function gst3bInputCells(key,o){return ['igst','cgst','sgst','cess'].map(h=>'<td><input class="f-input" id="g3b_'+key+'_'+h+'" type="number" min="0" step="0.01" value="'+gst3bNum(o&&o[h])+'"></td>').join('')}
function gst3bOpen5(){const d=gst3bData();feature('GSTR-3B — Table 5','GSTR-3B > 5','<div class="gst-alert info">Enter applicable exempt, nil-rated and non-GST inward-supply values for training.</div><div class="gst-form-grid"><div><label>Inter-State Inward Supplies</label><input id="g3b5is" class="f-input" type="number" min="0" value="'+gst3bNum(d.input.t5is)+'"></div><div><label>Intra-State Inward Supplies</label><input id="g3b5intra" class="f-input" type="number" min="0" value="'+gst3bNum(d.input.t5intra)+'"></div></div><div class="gst-action-row"><button class="gst-action" onclick="gst3bSave5()">SAVE</button><button class="gst-action secondary" onclick="gst3bOpen()">BACK</button></div><div id="gst3bSectionMsg" class="demo-note"></div>')}
function gst3bSaveSection(type){const d=gst3bData();gst3bReadInputs(d);d.status='Saved';d.savedAt=new Date().toISOString();d.audit.push({at:d.savedAt,action:'SAVE '+type});gst3bSave(d);gst3bOpen()}
function gst3bSave32(){const d=gst3bData();d.input.t32unreg=gst3bNum(document.getElementById('g3b32unreg').value);d.input.t32comp=gst3bNum(document.getElementById('g3b32comp').value);d.input.t32uin=gst3bNum(document.getElementById('g3b32uin').value);d.status='Saved';d.savedAt=new Date().toISOString();gst3bSave(d);gst3bOpen()}
function gst3bSaveITC(){const d=gst3bData();gst3bReadInputs(d);d.status='Saved';d.savedAt=new Date().toISOString();gst3bSave(d);gst3bOpen()}
function gst3bSave5(){const d=gst3bData();d.input.t5is=gst3bNum(document.getElementById('g3b5is').value);d.input.t5intra=gst3bNum(document.getElementById('g3b5intra').value);d.status='Saved';d.savedAt=new Date().toISOString();gst3bSave(d);gst3bOpen()}
function gst3bSystemSummary(){const d=gst3bAutoPopulate(gst3bData()),l=gst3bLiability(d);feature('System Generated GSTR-3B Summary','GSTR-3B > System Generated Summary','<div class="gst-alert info">GST guidance describes system-generated GSTR-3B assistance based on GSTR-1 for specified liability tables and GSTR-2B for ITC/RCM assistance.</div><table class="gst-table"><tr><th>GSTR-1</th><td>'+esc(gst3bGstr1Source()&&gst3bGstr1Source().status||'Not filed')+'</td><th>GSTR-2B</th><td>'+esc(gst2BData().status)+'</td></tr><tr><th>Outward Taxable</th><td>'+gstMoney(d.system.a.taxable)+'</td><th>Zero Rated</th><td>'+gstMoney(d.system.b.taxable)+'</td></tr><tr><th>Nil / Exempt</th><td>'+gstMoney(d.system.c.taxable)+'</td><th>ITC Available</th><td>'+gstMoney(gst3bSum(d.system.itc))+'</td></tr><tr><th>Calculated Total Payable</th><td colspan="3"><b>'+gstMoney(l.total)+'</b></td></tr></table><button class="gst-action secondary" onclick="gst3bOpen()">BACK</button>')}
function gst3bPreview(){const d=gst3bData();gst3bReadInputs(d);const l=gst3bLiability(d);feature('GSTR-3B — Preview','GSTR-3B > Preview','<div class="gst-alert warning"><b>SIMULATED TRAINING RETURN — NOT A GOVERNMENT FILING</b></div><table class="gst-table"><tr><th>FY</th><td>'+esc(gstReturnContext().fy)+'</td><th>Period</th><td>'+esc(gstReturnContext().period)+'</td></tr><tr><th>Output / RCM / Other</th><td>'+gstMoney(gst3bSum(l.out))+'</td><th>Eligible ITC</th><td>'+gstMoney(gst3bSum(l.itc))+'</td></tr><tr><th>Net Tax</th><td>'+gstMoney(gst3bSum(l.net))+'</td><th>Interest / Fee / Penalty</th><td>'+gstMoney(gst3bSum(l.charges))+'</td></tr><tr><th>Total Payable</th><td colspan="3"><b>'+gstMoney(l.total)+'</b></td></tr></table><div class="gst-action-row"><button class="gst-action" onclick="gst3bPayment()">PROCEED TO PAYMENT</button><button class="gst-action secondary" onclick="gst3bOpen()">BACK</button></div>')}
function gst3bValidate(){const d=gst3bData();gst3bReadInputs(d);const errors=[];for(const h of ['igst','cgst','sgst','cess'])if(gst3bNum(d.input.itcB[h])>gst3bNum(d.input.itcA[h]))errors.push('ITC reversal for '+h.toUpperCase()+' exceeds available ITC.');if(d.status==='Filed')errors.push('This return is already filed.');if(errors.length){feature('GSTR-3B — Validation Error','GSTR-3B > Validate','<div class="gst-alert error"><b>Validation failed.</b><ul>'+errors.map(esc).map(x=>'<li>'+x+'</li>').join('')+'</ul></div><button class="gst-action secondary" onclick="gst3bOpen()">BACK</button>');return false}d.status='Validated';d.validatedAt=new Date().toISOString();d.savedAt=d.validatedAt;gst3bSave(d);feature('GSTR-3B — Validation Successful','GSTR-3B > Validate','<div class="gst-alert success"><b>GSTR-3B validated successfully.</b> Proceed to payment/offset.</div><button class="gst-action" onclick="gst3bPayment()">PROCEED TO PAYMENT</button> <button class="gst-action secondary" onclick="gst3bOpen()">BACK</button>');return true}
function gst3bCash(){return gstRead('gstCashLedgerTraining',{balance:25250,transactions:[]})}
function gst3bCredit(){const d=gst3bData(),l=gst3bLiability(d);return Math.min(42800,gst3bSum(l.itc))}
function gst3bPayment(){const d=gst3bData();if(d.status!=='Validated'){feature('GSTR-3B — Payment','GSTR-3B > Payment','<div class="gst-alert warning"><b>Validation is required before payment.</b> Validate the saved GSTR-3B first.</div><button class="gst-action" onclick="gst3bValidate()">VALIDATE</button> <button class="gst-action secondary" onclick="gst3bOpen()">BACK</button>');return}const l=gst3bLiability(d),credit=gst3bCredit(),cash=gst3bCash();feature('GSTR-3B — Payment / Offset Liability','GSTR-3B > Payment','<div class="gst-alert info"><b>Payment stage:</b> use available eligible ITC and cash to offset the calculated liability. The statutory head-by-head utilisation rules are not reproduced in full; this is an aggregate training control.</div><table class="gst-table"><tr><th>Total Liability</th><td>'+gstMoney(l.total)+'</td><th>Eligible ITC</th><td>'+gstMoney(credit)+'</td><th>Cash Available</th><td>'+gstMoney(cash.balance)+'</td></tr></table><div class="gst-form-grid"><div><label>ITC to Utilise</label><input id="g3bCreditUse" class="f-input" type="number" min="0" step="0.01" value="'+Math.min(credit,l.total).toFixed(2)+'"></div><div><label>Cash to Utilise</label><input id="g3bCashUse" class="f-input" type="number" min="0" step="0.01" value="'+Math.max(0,l.total-Math.min(credit,l.total)).toFixed(2)+'"></div></div><div class="gst-action-row"><button class="gst-action" onclick="gst3bOffset()">MAKE PAYMENT / OFFSET</button><button class="gst-action secondary" onclick="gst3bOpen()">BACK</button></div><div id="gst3bPayMsg" class="demo-note"></div>')}
function gst3bOffset(){const d=gst3bData(),l=gst3bLiability(d),credit=gst3bNum(document.getElementById('g3bCreditUse').value),cashUse=gst3bNum(document.getElementById('g3bCashUse').value),ledger=gst3bCash();const m=document.getElementById('gst3bPayMsg');if(credit+cashUse+0.005<l.total){m.innerHTML='<span style="color:#9a2f2f"><b>Insufficient payment.</b> ITC plus cash must cover the total payable.</span>';return}if(credit>gst3bCredit()+0.005){m.innerHTML='<span style="color:#9a2f2f">ITC utilisation exceeds simulated available credit.</span>';return}if(cashUse>ledger.balance+0.005){m.innerHTML='<span style="color:#9a2f2f">Cash utilisation exceeds simulated cash balance.</span>';return}ledger.balance-=cashUse;ledger.transactions.push({at:new Date().toISOString(),type:'GSTR-3B Offset',credit,cash:cashUse,reference:'CIN-SIM-'+Date.now().toString().slice(-10)});d.payment={creditUsed:credit,cashUsed:cashUse,reference:'CIN-SIM-'+Date.now().toString().slice(-10)};d.status='Payment Completed';d.audit.push({at:new Date().toISOString(),action:'Payment / Offset'});gstWrite('gstCashLedgerTraining',ledger);gst3bSave(d);feature('GSTR-3B — Payment Successful','GSTR-3B > Payment > Offset','<div class="gst-alert success"><b>Payment / offset completed successfully in the training simulator.</b></div><table class="gst-table"><tr><th>Total Liability</th><td>'+gstMoney(l.total)+'</td><th>ITC Utilised</th><td>'+gstMoney(credit)+'</td></tr><tr><th>Cash Utilised</th><td>'+gstMoney(cashUse)+'</td><th>Remaining Cash</th><td>'+gstMoney(ledger.balance)+'</td></tr><tr><th>Simulated CIN</th><td colspan="3">'+esc(d.payment.reference)+'</td></tr></table><button class="gst-action" onclick="gst3bFilePage()">PROCEED TO FILE</button>')}
function gst3bFilePage(){const d=gst3bData();if(d.status!=='Payment Completed'){gst3bPayment();return}feature('GSTR-3B — Filing','GSTR-3B > Filing','<div class="gst-alert info">Review the declaration and authorized signatory. Filing is simulated locally and does not contact GSTN.</div><table class="gst-table"><tr><th>Period</th><td>'+esc(gstReturnContext().period)+'</td><th>Payment Reference</th><td>'+esc(d.payment.reference||'')+'</td></tr></table><div class="gst-form-grid"><div><label>Authorized Signatory *</label><input id="g3bSignatory" class="f-input" value="Demo Authorized Signatory"></div><div><label>Filing Mode</label><select id="g3bMode" class="f-select"><option>Simulated EVC</option><option>Simulated DSC</option></select></div></div><div class="gst-action-row"><button class="gst-action" onclick="gst3bFile()">FILE GSTR-3B</button><button class="gst-action secondary" onclick="gst3bOpen()">BACK</button></div><div id="gst3bFileMsg" class="demo-note"></div>')}
function gst3bFile(){const d=gst3bData(),m=document.getElementById('gst3bFileMsg');if(d.status!=='Payment Completed'){m.innerHTML='<span style="color:#9a2f2f">Complete payment/offset before filing.</span>';return}if(!document.getElementById('g3bSignatory').value.trim()){m.innerHTML='<span style="color:#9a2f2f">Authorized Signatory is required.</span>';return}d.status='Filed';d.filedAt=new Date().toISOString();d.reference='GSTR3B-SIM-'+Date.now().toString().slice(-10);d.audit.push({at:d.filedAt,action:'FILE GSTR-3B',reference:d.reference});gst3bSave(d);m.innerHTML='<span style="color:#176b35"><b>GSTR-3B filed successfully in the training simulator.</b><br>Simulated ARN: '+esc(d.reference)+'</span>';setTimeout(gst3bFilePage,300)}
function gstGstr3BFiledForPeriod(){try{return gst3bData().status==='Filed'}catch(e){return false}}
const _gstOpenReturn3B=window.gstOpenReturn;window.gstOpenReturn=function(name){if(name==='GSTR-3B')return gst3bOpen();return _gstOpenReturn3B(name)};
const _gstFeatureNav3B=featureNav;featureNav=function(label){if(label==='GSTR-3B')return gst3bOpen();return _gstFeatureNav3B(label)};
const _gstSearchReturns3B=gstSearchReturns;gstSearchReturns=function(){_gstSearchReturns3B();const box=document.getElementById('gstReturnResults');if(!box)return;box.querySelectorAll('.gst-return-tile').forEach(x=>{if((x.querySelector('.rt-head')?.textContent||'').trim()==='GSTR-3B')x.remove()});const fy=document.getElementById('gstFY')?.value||'2026-27',period=document.getElementById('gstPeriod')?.value||'Jul 2026',d=gst3bData(),tile=document.createElement('div');tile.className='gst-return-tile';tile.innerHTML='<div class="rt-head">GSTR-3B</div><div class="rt-body"><div class="rt-row"><span>Period</span><b>'+esc(period)+'</b></div><div class="rt-row"><span>Status</span><b>'+esc(d.status)+'</b></div><div class="rt-row"><span>Financial Year</span><b>'+esc(fy)+'</b></div><div class="rt-actions"><button class="gst-action" onclick="gstOpenReturn(\'GSTR-3B\')">OPEN / PREPARE ONLINE</button><button class="gst-action secondary" onclick="gst3bSystemSummary()">SYSTEM GENERATED 3B</button></div></div>';box.appendChild(tile)};
const _gstFeature3B=feature;feature=function(title,sub,body){_gstFeature3B(title,sub,body);document.querySelectorAll('#featureBody .gst-side-group').forEach(g=>{const h=g.querySelector('h4');if(h&&h.textContent.trim()==='Returns'&&!g.querySelector('[data-gstr3b-link]')){const a=document.createElement('a');a.setAttribute('data-gstr3b-link','1');a.textContent='GSTR-3B';a.onclick=()=>gst3bOpen();g.appendChild(a)}})};


/* ===== GST LEDGER / PAYMENT ENGINE — CONNECTED TRAINING LAYER ===== */
(function(){
  const HEADS=['igst','cgst','sgst','cess'];
  const MINORS=['tax','interest','penalty','fee','others'];
  const money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const now=()=>new Date().toISOString();
  const key='gstLedgerEngineV2';
  function base(){return {version:2,cash:{igst:{tax:25250,interest:0,penalty:0,fee:0,others:0},cgst:{tax:0,interest:0,penalty:0,fee:0,others:0},sgst:{tax:0,interest:0,penalty:0,fee:0,others:0},cess:{tax:0,interest:0,penalty:0,fee:0,others:0}},credit:{igst:18000,cgst:12400,sgst:12400,cess:0},liability:{igst:{tax:9000,interest:0,penalty:0,fee:0,others:0},cgst:{tax:4725,interest:0,penalty:0,fee:0,others:0},sgst:{tax:4725,interest:0,penalty:0,fee:0,others:0},cess:{tax:0,interest:0,penalty:0,fee:0,others:0}},transactions:[],challans:[],audit:[]}}
  function read(){let x;try{x=JSON.parse(localStorage.getItem(key)||'null')}catch(e){x=null}if(!x||x.version!==2){x=base();localStorage.setItem(key,JSON.stringify(x))}return x}
  function save(x){localStorage.setItem(key,JSON.stringify(x)); return x}
  function totalMinor(h){return MINORS.reduce((a,m)=>a+Number(h[m]||0),0)}
  function cashTotal(x){return HEADS.reduce((a,h)=>a+totalMinor(x.cash[h]),0)}
  function creditTotal(x){return HEADS.reduce((a,h)=>a+Number(x.credit[h]||0),0)}
  function liabilityTotal(x){return HEADS.reduce((a,h)=>a+totalMinor(x.liability[h]),0)}
  function audit(x,action,ref,detail){x.audit.push({at:now(),user:'Demo Taxpayer',module:'Ledgers / Payments',action,reference:ref||'',detail:detail||''})}
  function tx(x,type,ref,amounts,detail){x.transactions.push({at:now(),type,reference:ref||'',amounts,detail:detail||''})}
  function ledgerRows(obj,kind){return HEADS.map(h=>`<tr><td>${h.toUpperCase()}</td>${MINORS.map(m=>`<td>${money(obj[h]?.[m]||0)}</td>`).join('')}<td><b>${money(kind==='credit'?(obj[h]||0):totalMinor(obj[h]))}</b></td></tr>`).join('')}
  function nav(title,sub,body){feature(title,sub,body)}

  function cashLedger(){const x=read();nav('Electronic Cash Ledger','Services > Ledgers > Electronic Cash Ledger',`
    <div class="gst-alert info"><b>Electronic Cash Ledger</b> — simulated post-login ledger. Cash is recorded major-head/minor-head wise. A successful challan payment credits the ledger only after simulated CIN confirmation.</div>
    <div class="gst-summary-grid">
      <div class="gst-summary"><div class="label">Total Cash Balance</div><div class="value">${money(cashTotal(x))}</div><div class="sub">As on ${new Date().toLocaleDateString('en-IN')}</div></div>
      <div class="gst-summary"><div class="label">IGST</div><div class="value">${money(totalMinor(x.cash.igst))}</div><div class="sub">Major Head</div></div>
      <div class="gst-summary"><div class="label">CGST</div><div class="value">${money(totalMinor(x.cash.cgst))}</div><div class="sub">Major Head</div></div>
      <div class="gst-summary"><div class="label">SGST/UTGST</div><div class="value">${money(totalMinor(x.cash.sgst))}</div><div class="sub">Major Head</div></div>
    </div>
    <div class="gst-action-row"><button class="gst-action" onclick="challan()">CREATE CHALLAN (PMT-06)</button><button class="gst-action secondary" onclick="gstPmt09()">FILE PMT-09</button><button class="gst-action secondary" onclick="gstLedgerHistory('cash')">VIEW TRANSACTIONS</button></div>
    <table class="gst-table"><thead><tr><th>Major Head</th>${MINORS.map(m=>`<th>${m[0].toUpperCase()+m.slice(1)}</th>`).join('')}<th>Total</th></tr></thead><tbody>${ledgerRows(x.cash,'cash')}</tbody></table>
    <div class="gst-note">Official GST guidance describes IGST, CGST, SGST/UTGST and CESS major heads with Tax, Interest, Penalty, Fee and Others minor heads. citeturn0search0</div>`)}

  function creditLedger(){const x=read();nav('Electronic Credit Ledger','Services > Ledgers > Electronic Credit Ledger',`
    <div class="gst-alert info"><b>Electronic Credit Ledger</b> — simulated ITC balance. ITC is kept separate from the Electronic Cash Ledger.</div>
    <div class="gst-summary-grid">${HEADS.map(h=>`<div class="gst-summary"><div class="label">${h.toUpperCase()}</div><div class="value">${money(x.credit[h])}</div><div class="sub">Available ITC</div></div>`).join('')}</div>
    <table class="gst-table"><thead><tr><th>Major Head</th><th>Opening / Current Balance</th><th>Source</th><th>Status</th></tr></thead><tbody>${HEADS.map(h=>`<tr><td>${h.toUpperCase()}</td><td>${money(x.credit[h])}</td><td>${h==='igst'?'GSTR-2B / Imports':'GSTR-2B / Eligible ITC'}</td><td><span class="gst-status green">Available</span></td></tr>`).join('')}</tbody></table>
    <div class="gst-action-row"><button class="gst-action secondary" onclick="gstLedgerHistory('credit')">VIEW TRANSACTIONS</button><button class="gst-action secondary" onclick="gst3bOpen()">OPEN GSTR-3B</button></div>
    <div class="gst-note">The simulator prevents cash-ledger balances from being treated as ITC and keeps credit and cash as separate ledgers.</div>`)}

  function liabilityRegister(){const x=read();nav('Electronic Liability Register','Services > Ledgers > Electronic Liability Register',`
    <div class="gst-alert info"><b>Electronic Liability Register</b> — simulated liabilities generated from returns and other proceedings.</div>
    <div class="gst-summary-grid"><div class="gst-summary"><div class="label">Total Outstanding</div><div class="value">${money(liabilityTotal(x))}</div><div class="sub">All major/minor heads</div></div><div class="gst-summary"><div class="label">IGST Liability</div><div class="value">${money(totalMinor(x.liability.igst))}</div></div><div class="gst-summary"><div class="label">CGST Liability</div><div class="value">${money(totalMinor(x.liability.cgst))}</div></div><div class="gst-summary"><div class="label">SGST Liability</div><div class="value">${money(totalMinor(x.liability.sgst))}</div></div></div>
    <table class="gst-table"><thead><tr><th>Major Head</th>${MINORS.map(m=>`<th>${m[0].toUpperCase()+m.slice(1)}</th>`).join('')}<th>Total</th></tr></thead><tbody>${ledgerRows(x.liability,'liability')}</tbody></table>
    <div class="gst-action-row"><button class="gst-action secondary" onclick="gstLedgerHistory('liability')">VIEW LIABILITY HISTORY</button><button class="gst-action secondary" onclick="gst3bOpen()">OPEN GSTR-3B</button></div>`)}

  function gstLedgerHistory(kind){const x=read();const filtered=x.transactions.filter(t=>kind==='cash'?/cash|challan|offset|pmt-09/i.test((t.type||'')+' '+(t.detail||'')):kind==='credit'?/credit|itc|offset/i.test((t.type||'')+' '+(t.detail||'')):true);nav((kind==='cash'?'Cash':kind==='credit'?'Credit':'Liability')+' Ledger Transactions','Services > Ledgers > Transactions',`<div class="gst-action-row"><button class="gst-action secondary" onclick="${kind==='cash'?'cashLedger':kind==='credit'?'creditLedger':'liabilityRegister'}()">BACK TO LEDGER</button></div><table class="gst-table"><thead><tr><th>Date/Time</th><th>Type</th><th>Reference</th><th>Detail</th></tr></thead><tbody>${filtered.slice().reverse().map(t=>`<tr><td>${new Date(t.at).toLocaleString('en-IN')}</td><td>${esc(t.type)}</td><td>${esc(t.reference||'-')}</td><td>${esc(t.detail||'-')}</td></tr>`).join('')||'<tr><td colspan="4">No transactions found.</td></tr>'}</tbody></table>`)}

  function pmt09(){const x=read();nav('Form GST PMT-09 — Transfer of Amount','Services > Ledgers > Electronic Cash Ledger > PMT-09',`
    <div class="gst-alert info">PMT-09 is used in the simulator to transfer available cash between permitted major/minor heads. The transfer never creates new money.</div>
    <div class="gst-form-grid"><div><label>From Major Head</label><select id="p9FromH" class="f-select">${HEADS.map(h=>`<option value="${h}">${h.toUpperCase()}</option>`).join('')}</select></div><div><label>From Minor Head</label><select id="p9FromM" class="f-select">${MINORS.map(m=>`<option value="${m}">${m}</option>`).join('')}</select></div><div><label>To Major Head</label><select id="p9ToH" class="f-select">${HEADS.map(h=>`<option value="${h}">${h.toUpperCase()}</option>`).join('')}</select></div><div><label>To Minor Head</label><select id="p9ToM" class="f-select">${MINORS.map(m=>`<option value="${m}">${m}</option>`).join('')}</select></div><div><label>Amount *</label><input id="p9Amt" class="f-input" type="number" min="0.01" step="0.01"></div></div>
    <div class="gst-action-row"><button class="gst-action" onclick="gstDoPmt09()">FILE PMT-09 (SIMULATED)</button><button class="gst-action secondary" onclick="cashLedger()">CANCEL</button></div><div id="p9Msg" class="demo-note"></div>`)}
  function doPmt09(){const x=read(),fh=p9FromH.value,fm=p9FromM.value,th=p9ToH.value,tm=p9ToM.value,a=Number(p9Amt.value||0),m=document.getElementById('p9Msg');if(!a||a<0){m.innerHTML='<span style="color:#9a2f2f">Enter a valid amount.</span>';return}if(x.cash[fh][fm]<a-0.005){m.innerHTML='<span style="color:#9a2f2f">Insufficient balance in the selected source head.</span>';return}if(fh===th&&fm===tm){m.innerHTML='<span style="color:#9a2f2f">Source and destination must be different.</span>';return}x.cash[fh][fm]-=a;x.cash[th][tm]+=a;const ref='PMT09-SIM-'+Date.now().toString().slice(-10);tx(x,'PMT-09',ref,{from:{head:fh,minor:fm,amount:a},to:{head:th,minor:tm,amount:a}},'Cash ledger transfer');audit(x,'FILE PMT-09',ref,'Transfer '+money(a)+' from '+fh+'/'+fm+' to '+th+'/'+tm);save(x);m.innerHTML='<span style="color:#176b35"><b>PMT-09 filed successfully in the training simulator.</b> Reference: '+ref+'</span>'}

  function challanV2(){const x=read();nav('Create Challan — Form GST PMT-06','Services > Payments > Create Challan',`
    <div class="gst-alert info"><b>Create Challan</b> — select the major/minor heads and amount to deposit. Payment is not treated as a cash-ledger credit until the simulated bank confirmation/CIN stage is completed.</div>
    <div class="gst-form-grid"><div><label>GSTIN</label><input class="f-input" id="cg" value="32ABCDE1234F1Z5" maxlength="15" readonly><label>Tax Period</label><select class="f-select" id="cPeriod"><option>Jul 2026</option><option>Jun 2026</option><option>Aug 2026</option></select></div>
    <div><label>IGST — Tax</label><input class="f-input cAmt" id="cIGST" type="number" min="0" step="0.01" value="0"><label>CGST — Tax</label><input class="f-input cAmt" id="cCGST" type="number" min="0" step="0.01" value="0"><label>SGST/UTGST — Tax</label><input class="f-input cAmt" id="cSGST" type="number" min="0" step="0.01" value="0"><label>CESS — Tax</label><input class="f-input cAmt" id="cCESS" type="number" min="0" step="0.01" value="0"></div></div>
    <div class="gst-form-grid"><div><label>Interest</label><input class="f-input cMinor" id="cInterest" type="number" min="0" step="0.01" value="0"></div><div><label>Penalty</label><input class="f-input cMinor" id="cPenalty" type="number" min="0" step="0.01" value="0"></div><div><label>Fee</label><input class="f-input cMinor" id="cFee" type="number" min="0" step="0.01" value="0"></div><div><label>Others</label><input class="f-input cMinor" id="cOthers" type="number" min="0" step="0.01" value="0"></div></div>
    <div class="gst-summary"><div class="label">Total Challan Amount</div><div class="value" id="challanTotal">₹0.00</div></div>
    <div class="gst-action-row"><button class="gst-action" onclick="gstMakeChallanV2()">CREATE CHALLAN</button><button class="gst-action secondary" onclick="cashLedger()">BACK</button></div><div id="challanMsg" class="demo-note"></div>`);document.querySelectorAll('.cAmt,.cMinor').forEach(el=>el.oninput=()=>{let n=0;document.querySelectorAll('.cAmt,.cMinor').forEach(y=>n+=Number(y.value||0));document.getElementById('challanTotal').textContent=money(n)})}
  function makeChallanV2(){const x=read(),vals={igst:{tax:Number(cIGST.value||0)},cgst:{tax:Number(cCGST.value||0)},sgst:{tax:Number(cSGST.value||0)},cess:{tax:Number(cCESS.value||0)}},minor={interest:Number(cInterest.value||0),penalty:Number(cPenalty.value||0),fee:Number(cFee.value||0),others:Number(cOthers.value||0)},total=HEADS.reduce((a,h)=>a+vals[h].tax,0)+Object.values(minor).reduce((a,b)=>a+b,0),m=document.getElementById('challanMsg');if(total<=0){m.innerHTML='<span style="color:#9a2f2f">Enter at least one challan amount.</span>';return}const cpin='CPIN-SIM-'+Date.now().toString().slice(-12);const challan={cpin,period:cPeriod.value,createdAt:now(),status:'Created',amounts:vals,minor, total};x.challans.push(challan);audit(x,'CREATE CHALLAN',cpin,'PMT-06 simulated challan created for '+money(total));save(x);m.innerHTML='<span style="color:#176b35"><b>Challan generated successfully.</b><br>Simulated CPIN: <b>'+cpin+'</b><br>Amount: <b>'+money(total)+'</b><br><button class="gst-action" onclick="gstPaymentPage(\''+cpin+'\')">PROCEED TO PAYMENT</button></span>'}
  function paymentPage(cpin){const x=read(),c=x.challans.find(z=>z.cpin===cpin);if(!c){paymentStatus();return}nav('Payment — Challan','Services > Payments > Payment',`<div class="gst-alert info">Payment is simulated. Choose a payment mode and complete the simulated bank confirmation. The Cash Ledger is updated only after CIN confirmation.</div><table class="gst-table"><tr><th>CPIN</th><td>${c.cpin}</td><th>Period</th><td>${esc(c.period)}</td></tr><tr><th>Amount</th><td colspan="3"><b>${money(c.total)}</b></td></tr></table><div class="gst-form-grid"><div><label>Payment Mode</label><select id="payMode" class="f-select"><option>Net Banking — Simulated</option><option>NEFT / RTGS — Simulated</option><option>Credit/Debit Card — Simulated</option></select></div><div><label>Bank Reference (demo)</label><input id="bankRef" class="f-input" value="BANK-SIM-${Date.now().toString().slice(-8)}"></div></div><div class="gst-action-row"><button class="gst-action" onclick="gstConfirmPayment('${c.cpin}')">CONFIRM SIMULATED PAYMENT</button><button class="gst-action secondary" onclick="challan()">BACK</button></div><div class="gst-note">A CIN is generated only after simulated bank confirmation.</div>`)}
  function confirmPayment(cpin){const x=read(),c=x.challans.find(z=>z.cpin===cpin);if(!c)return;if(c.status==='Paid'){paymentStatus();return}const cin='CIN-SIM-'+Date.now().toString().slice(-12);c.status='Paid';c.paidAt=now();c.cin=cin;c.bankReference=bankRef.value.trim();HEADS.forEach(h=>{x.cash[h].tax+=Number(c.amounts[h]?.tax||0)});MINORS.forEach(m=>{const a=Number(c.minor[m]||0);if(a){const head=m==='tax'?'tax':m;}}); // non-tax minors are allocated to CGST for training traceability only when explicitly entered
    if(c.minor.interest)x.cash.cgst.interest+=c.minor.interest;if(c.minor.penalty)x.cash.cgst.penalty+=c.minor.penalty;if(c.minor.fee)x.cash.cgst.fee+=c.minor.fee;if(c.minor.others)x.cash.cgst.others+=c.minor.others;
    tx(x,'Challan Payment / Cash Ledger Credit',cin,{amount:c.total},'CPIN '+cpin+' confirmed by simulated bank');audit(x,'PAYMENT CONFIRMED',cin,'Cash Ledger credited after CIN confirmation');save(x);nav('Payment Successful','Services > Payments > Payment',`<div class="gst-alert success"><b>Payment successfully confirmed in the training simulator.</b></div><table class="gst-table"><tr><th>CPIN</th><td>${c.cpin}</td><th>CIN</th><td><b>${cin}</b></td></tr><tr><th>Bank Reference</th><td>${esc(c.bankReference||'-')}</td><th>Amount</th><td><b>${money(c.total)}</b></td></tr></table><div class="gst-action-row"><button class="gst-action" onclick="cashLedger()">VIEW CASH LEDGER</button><button class="gst-action secondary" onclick="paymentStatus()">PAYMENT STATUS</button></div><div class="gst-note">SIMULATED TRAINING TRANSACTION — NOT A GOVERNMENT PAYMENT.</div>`)}
  function paymentStatusV2(){const x=read();nav('Track Payment Status','Services > Payments > Track Payment Status',`<div class="gst-alert info">Search simulated CPIN/CIN records generated inside this training environment.</div><div class="gst-form-grid"><div><label>CPIN / CIN</label><input id="paySearch" class="f-input" placeholder="CPIN-SIM-... or CIN-SIM-..."></div></div><button class="gst-action" onclick="gstSearchPayment()">SEARCH</button><div id="payResult"></div><table class="gst-table"><thead><tr><th>CPIN</th><th>Period</th><th>Amount</th><th>Status</th><th>CIN</th></tr></thead><tbody>${x.challans.slice().reverse().map(c=>`<tr><td>${c.cpin}</td><td>${esc(c.period)}</td><td>${money(c.total)}</td><td>${c.status}</td><td>${c.cin||'-'}</td></tr>`).join('')||'<tr><td colspan="5">No challans found.</td></tr>'}</tbody></table>`)}
  function searchPayment(){const x=read(),q=(paySearch.value||'').trim().toUpperCase(),c=x.challans.find(z=>z.cpin===q||z.cin===q),r=document.getElementById('payResult');r.innerHTML=c?`<div class="gst-alert ${c.status==='Paid'?'success':'warning'}"><b>${c.status}</b> — CPIN ${c.cpin}, Amount ${money(c.total)}, CIN ${c.cin||'Not generated yet'}.</div>`:'<div class="gst-alert error">No matching simulated payment found.</div>'}

  // Public aliases used by the existing UI.
  window.gstLedgerEngine=read;window.cashLedger=cashLedger;window.creditLedger=creditLedger;window.liabilityRegister=liabilityRegister;window.gstPmt09=pmt09;window.gstDoPmt09=doPmt09;window.gstMakeChallanV2=makeChallanV2;window.gstPaymentPage=paymentPage;window.gstConfirmPayment=confirmPayment;window.gstSearchPayment=searchPayment;
  window.challan=challanV2;window.paymentStatus=paymentStatusV2;
  const oldOpenDashboard=window.openTaxpayerDashboard;
  window.openTaxpayerDashboard=function(){
    oldOpenDashboard();
    const x=read();
    const vals=[money(cashTotal(x)),money(creditTotal(x)),money(liabilityTotal(x))];
    const cards=document.querySelectorAll('#featureBody .gst-summary .value');
    vals.forEach((v,i)=>{if(cards[i])cards[i].textContent=v});
  };
  const oldOpenFeature=window.openFeature;
  window.openFeature=function(t){
    if(t==='cash-ledger')return cashLedger();
    if(t==='challan')return challanV2();
    if(t==='payment-status')return paymentStatusV2();
    return oldOpenFeature(t);
  };

  // Route the existing sidebar/menu into real ledger pages without changing the visual shell.
  const oldFeatureNav=window.featureNav;
  window.featureNav=function(label){
    const m={'Electronic Cash Ledger':cashLedger,'Electronic Credit Ledger':creditLedger,'Electronic Liability Register':liabilityRegister,'Liability Register':liabilityRegister,'Create Challan':challanV2,'Track Payment':paymentStatusV2,'Track Payment Status':paymentStatusV2,'Dashboard':openTaxpayerDashboard,'Returns Dashboard':openReturnsDashboard};
    if(m[label])return m[label]();
    return oldFeatureNav(label);
  };

  // Keep legacy cash-ledger key and the new shared engine in sync for older GSTR-3B code.
  function syncLegacy(){const x=read();localStorage.setItem('gstCashLedgerTraining',JSON.stringify({balance:cashTotal(x),transactions:x.transactions.filter(t=>/cash|challan|offset/i.test(t.type||''))}))}
  syncLegacy();

  // Replace GSTR-3B payment/offset with the shared ledgers and head-wise controls.
  window.gst3bPayment=function(){const d=gst3bData();if(d.status!=='Validated'){return feature('GSTR-3B — Payment / Offset Liability','GSTR-3B > Payment',`<div class="gst-alert warning"><b>Validation is required before payment.</b> Save and validate GSTR-3B first.</div><button class="gst-action" onclick="gst3bValidate()">VALIDATE</button><button class="gst-action secondary" onclick="gst3bOpen()">BACK</button>`)}const x=read(),l=gst3bLiability(d),total=gst3bSum(l.net)+gst3bSum(l.charges),cred=creditTotal(x),cash=cashTotal(x);feature('GSTR-3B — Payment / Offset Liability','GSTR-3B > Payment / Offset',`<div class="gst-alert info"><b>Payment / Offset</b> — first use eligible ITC, then available cash as required. The simulator applies a training allocation across major heads and records every debit in the shared ledgers.</div><div class="gst-summary-grid"><div class="gst-summary"><div class="label">Total Liability</div><div class="value">${money(total)}</div></div><div class="gst-summary"><div class="label">Credit Ledger</div><div class="value">${money(cred)}</div></div><div class="gst-summary"><div class="label">Cash Ledger</div><div class="value">${money(cash)}</div></div><div class="gst-summary"><div class="label">Additional Cash Required</div><div class="value">${money(Math.max(0,total-cred))}</div></div></div><table class="gst-table"><thead><tr><th>Head</th><th>Liability</th><th>Credit Available</th><th>Cash Available</th><th>Suggested ITC</th><th>Suggested Cash</th></tr></thead><tbody>${HEADS.map(h=>{const li=totalMinor(x.liability[h]),ca=x.credit[h],av=totalMinor(x.cash[h]);const ci=Math.min(li,ca),cs=Math.max(0,li-ci);return `<tr><td>${h.toUpperCase()}</td><td>${money(li)}</td><td>${money(ca)}</td><td>${money(av)}</td><td><input class="f-input g3bCI" data-head="${h}" type="number" min="0" step="0.01" value="${ci.toFixed(2)}"></td><td><input class="f-input g3bCA" data-head="${h}" type="number" min="0" step="0.01" value="${cs.toFixed(2)}"></td></tr>`}).join('')}</tbody></table><div class="gst-action-row"><button class="gst-action" onclick="gst3bOffsetV2()">MAKE PAYMENT / OFFSET</button><button class="gst-action secondary" onclick="gst3bPreview()">PREVIEW</button><button class="gst-action secondary" onclick="gst3bOpen()">BACK</button></div><div class="gst-note">If cash is insufficient, create a PMT-06 challan first. A challan payment credits the cash ledger only after simulated CIN confirmation.</div>`)};
  window.gst3bOffsetV2=function(){const d=gst3bData(),x=read(),l=gst3bLiability(d),rows=[...document.querySelectorAll('.g3bCI')],totalLi=gst3bSum(l.net)+gst3bSum(l.charges);let usedC=0,usedCash=0;const errors=[];for(const el of rows){const h=el.dataset.head,ci=Number(el.value||0),ca=Number(document.querySelector(`.g3bCA[data-head="${h}"]`)?.value||0),li=totalMinor(x.liability[h]);if(ci<0||ca<0)errors.push(h.toUpperCase()+': negative payment is not allowed.');if(ci>x.credit[h]+.005)errors.push(h.toUpperCase()+': ITC exceeds available credit.');if(ca>totalMinor(x.cash[h])+.005)errors.push(h.toUpperCase()+': cash exceeds available cash under this major head.');if(ci+ca>li+.005)errors.push(h.toUpperCase()+': payment exceeds liability.');usedC+=ci;usedCash+=ca}if(usedC+usedCash+0.005<totalLi)errors.push('ITC plus cash does not fully cover the return liability.');if(errors.length){feature('GSTR-3B — Offset Validation Error','GSTR-3B > Payment / Offset',`<div class="gst-alert error"><b>Offset failed.</b><ul>${errors.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div><button class="gst-action secondary" onclick="gst3bPayment()">BACK TO OFFSET</button>`);return}for(const el of rows){const h=el.dataset.head,ci=Number(el.value||0),ca=Number(document.querySelector(`.g3bCA[data-head="${h}"]`)?.value||0);x.credit[h]-=ci;x.cash[h].tax-=ca;const paid=ci+ca;let remaining=paid;for(const m of MINORS){const take=Math.min(Number(x.liability[h][m]||0),remaining);x.liability[h][m]-=take;remaining-=take;if(remaining<=.005)break}if(paid)tx(x,'GSTR-3B Offset',d.reference||'GSTR3B-SIM',{head:h,credit:ci,cash:ca},'Liability offset against GSTR-3B')}const ref='CIN-OFFSET-SIM-'+Date.now().toString().slice(-10);d.payment={creditUsed:usedC,cashUsed:usedCash,reference:ref};d.status='Payment Completed';d.audit.push({at:now(),action:'PAYMENT / OFFSET',reference:ref});audit(x,'GSTR-3B PAYMENT / OFFSET',ref,'ITC '+money(usedC)+' + Cash '+money(usedCash));save(x);syncLegacy();feature('GSTR-3B — Payment / Offset Successful','GSTR-3B > Payment / Offset',`<div class="gst-alert success"><b>Payment / offset completed successfully.</b></div><table class="gst-table"><tr><th>Total Liability</th><td>${money(totalLi)}</td><th>ITC Used</th><td>${money(usedC)}</td></tr><tr><th>Cash Used</th><td>${money(usedCash)}</td><th>Simulated Reference</th><td>${ref}</td></tr></table><div class="gst-action-row"><button class="gst-action" onclick="gst3bFilePage()">PROCEED TO FILE</button><button class="gst-action secondary" onclick="liabilityRegister()">VIEW LIABILITY REGISTER</button><button class="gst-action secondary" onclick="cashLedger()">VIEW CASH LEDGER</button></div>`)};

  // Use shared credit ledger balance in the existing GSTR-3B helpers.
  window.gst3bCredit=function(){return creditTotal(read())};
  window.gst3bCash=function(){const x=read();return {balance:cashTotal(x),transactions:x.transactions};};

  // After filing, keep the ledgers as the authoritative post-offset balances.
  const oldFile=window.gst3bFile;
  window.gst3bFile=function(){oldFile();setTimeout(()=>{syncLegacy();},50)};
})();

  /* ===== VIEW E-FILED RETURNS / ARN HISTORY ===== */
  (function(){
    function fk(){return 'gstFiledReturnsTraining'}
    function fr(){try{return JSON.parse(localStorage.getItem(fk())||'[]')}catch(e){return []}}
    function fw(a){localStorage.setItem(fk(),JSON.stringify(a))}
    function addFiled(d,form){if(!d||d.status!=='Filed'||!d.reference&&!d.arn)return;const c=gstReturnContext(),t=gstRead('gstTaxpayer',GST_DEMO)||GST_DEMO,a=fr(),ref=d.reference||d.arn,x={id:ref,form:form||'GSTR-3B',fy:d.fy||c.fy,period:d.period||c.period,arn:ref,filingDate:d.filedAt||new Date().toISOString(),status:'Filed',filingMode:d.filingMode||'Simulated EVC',gstin:t.gstin,signatory:d.signatory||'Demo Authorized Signatory',paymentReference:d.payment?.reference||''};const i=a.findIndex(z=>z.id===x.id);if(i>=0)a[i]=x;else a.push(x);fw(a)}
    window.gstAddFiledReturn=addFiled;
    function rows(a){return `<div class="gst-table-wrap"><table class="gst-table"><thead><tr><th>Financial Year</th><th>Return Period</th><th>Form</th><th>ARN</th><th>Filing Date</th><th>Status</th><th>Action</th></tr></thead><tbody>${a.length?a.map(x=>`<tr><td>${esc(x.fy)}</td><td>${esc(x.period)}</td><td><b>${esc(x.form)}</b></td><td>${esc(x.arn)}</td><td>${esc(new Date(x.filingDate).toLocaleDateString('en-IN'))}</td><td><span class="gst-status green">Filed</span></td><td><button class="gst-action" onclick="viewFiledReturn('${esc(x.id)}')">VIEW</button><button class="gst-action secondary" onclick="downloadFiledReturn('${esc(x.id)}')">DOWNLOAD</button></td></tr>`).join(''):'<tr><td colspan="7">No e-filed returns found.</td></tr>'}</tbody></table></div>`}
    window.viewEFiledReturns=function(){if(!gstRequireLogin('View e-Filed Returns'))return;const a=fr().slice().reverse();feature('View e-Filed Returns','Services > Returns > View e-Filed Returns',`<div class="gst-dash-head"><h2>View e-Filed Returns</h2><div class="gst-dash-meta"><span>GSTIN: <b>${esc((gstRead('gstTaxpayer',GST_DEMO)||GST_DEMO).gstin)}</b></span><span>Training Simulator</span></div></div><div class="gst-alert info"><b>View e-Filed Returns</b> — filed records are read-only training records; no government filing occurs.</div><div class="gst-form-grid"><div><label>Financial Year</label><select id="ferFY" class="f-select"><option>All Financial Years</option><option>2026-27</option><option>2025-26</option></select></div><div><label>Return Form</label><select id="ferForm" class="f-select"><option>All Forms</option><option>GSTR-1</option><option>GSTR-1A</option><option>GSTR-3B</option><option>GSTR-4</option><option>GSTR-5</option><option>GSTR-5A</option><option>GSTR-6</option><option>GSTR-7</option><option>GSTR-8</option><option>GSTR-9C</option><option>GSTR-10</option><option>GSTR-11</option></select></div><div><label>Return Period</label><select id="ferPeriod" class="f-select"><option>All Periods</option><option>Jul 2026</option><option>Aug 2026</option><option>Sep 2026</option></select></div><div><label>ARN</label><input id="ferSearch" class="f-input" placeholder="Enter simulated ARN"></div></div><div class="gst-action-row"><button class="gst-action" onclick="filterEFiledReturns()">SEARCH</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK</button></div><div id="eFiledResults">${rows(a)}</div>`)};
    window.filterEFiledReturns=function(){let a=fr(),fy=document.getElementById('ferFY')?.value||'All Financial Years',form=document.getElementById('ferForm')?.value||'All Forms',period=document.getElementById('ferPeriod')?.value||'All Periods',q=(document.getElementById('ferSearch')?.value||'').trim().toUpperCase();if(fy!=='All Financial Years')a=a.filter(x=>x.fy===fy);if(form!=='All Forms')a=a.filter(x=>x.form===form);if(period!=='All Periods')a=a.filter(x=>x.period===period);if(q)a=a.filter(x=>(x.arn||'').toUpperCase().includes(q));const b=document.getElementById('eFiledResults');if(b)b.innerHTML=rows(a.slice().reverse())};
    window.viewFiledReturn=function(id){const x=fr().find(z=>z.id===id);if(!x)return notify('Filed return not found.');feature('Filed Return — '+x.form,'Services > Returns > View e-Filed Returns > '+x.form,`<div class="gst-alert success"><b>Status: Filed</b><br>Simulated ARN: <b>${esc(x.arn)}</b></div><table class="gst-table"><tbody><tr><th>GSTIN</th><td>${esc(x.gstin)}</td><th>Form</th><td>${esc(x.form)}</td></tr><tr><th>Financial Year</th><td>${esc(x.fy)}</td><th>Return Period</th><td>${esc(x.period)}</td></tr><tr><th>ARN</th><td>${esc(x.arn)}</td><th>Filing Date</th><td>${esc(new Date(x.filingDate).toLocaleString('en-IN'))}</td></tr><tr><th>Filing Mode</th><td>${esc(x.filingMode)}</td><th>Authorized Signatory</th><td>${esc(x.signatory)}</td></tr><tr><th>Payment Reference</th><td colspan="3">${esc(x.paymentReference||'-')}</td></tr></tbody></table><div class="gst-alert warning"><b>Read-only:</b> Filed return data cannot be edited.</div><div class="gst-action-row"><button class="gst-action" onclick="downloadFiledReturn('${esc(x.id)}')">DOWNLOAD SIMULATED RETURN</button><button class="gst-action secondary" onclick="viewEFiledReturns()">BACK</button></div>`)};
    window.downloadFiledReturn=function(id){const x=fr().find(z=>z.id===id);if(!x)return;const blob=new Blob([JSON.stringify({documentType:'SIMULATED GST E-FILED RETURN',trainingNotice:'SIMULATED TRAINING DOCUMENT — NOT A GOVERNMENT DOCUMENT',...x},null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=x.form+'_'+x.arn+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),500)};
    const baseFile=window.gst3bFile;window.gst3bFile=function(){const d=gst3bData();if(d.status==='Filed'){notify('This GSTR-3B is already filed and is read-only.');return}const s=document.getElementById('g3bSignatory'),m=document.getElementById('g3bMode');d.signatory=s?.value?.trim()||'Demo Authorized Signatory';d.filingMode=m?.value||'Simulated EVC';gst3bSave(d);baseFile();setTimeout(()=>{try{addFiled(gst3bData(),'GSTR-3B')}catch(e){}},30)};
    const baseFeatureNav=window.featureNav;window.featureNav=function(label){if(label==='View e-Filed Returns'||label==='Filed Returns'||label==='View Filed Returns')return viewEFiledReturns();return baseFeatureNav(label)};
    const baseOpenFeature=window.openFeature;window.openFeature=function(t){if(t==='e-filed-returns'||t==='filed-returns')return viewEFiledReturns();return baseOpenFeature(t)};
  })();



/* ===== Extracted script block ===== */


/* ===== QRMP + IFF REALISTIC TRAINING PATCH ===== */
(function(){
  // Bug fix: this used to force every taxpayer to Quarterly/QRMP on every single page
  // load, overwriting whatever frequency was actually set (including Monthly, the
  // correct default for most taxpayers), with no way to opt back out. QRMP is meant to
  // be an optional, eligibility-gated choice (see gstQrmpOptIn below) — not something
  // silently forced on everyone. Only default a genuinely brand-new demo profile to
  // Monthly; never force-overwrite an existing choice.
  try{
    const p=gstRead('gstTaxpayer',null);
    if(p && !p.frequency){ p.frequency='Monthly'; gstWrite('gstTaxpayer',p); }
  }catch(e){}
  if(!GST_DEMO.frequency) GST_DEMO.frequency='Monthly';

  const oldReturnContext=window.gstReturnContext;
  window.gstReturnContext=function(){
    const fy=document.getElementById('gstFY')?.value||localStorage.getItem('gstReturnFY')||'2026-27';
    const period=document.getElementById('gstPeriod')?.value||localStorage.getItem('gstReturnPeriod')||'Jul 2026';
    localStorage.setItem('gstReturnFY',fy); localStorage.setItem('gstReturnPeriod',period);
    return {fy,period};
  };

  function quarterFor(period){
    const map={'Apr 2026':'Q1 FY2026-27','May 2026':'Q1 FY2026-27','Jun 2026':'Q1 FY2026-27','Jul 2026':'Q2 FY2026-27','Aug 2026':'Q2 FY2026-27','Sep 2026':'Q2 FY2026-27','Oct 2026':'Q3 FY2026-27','Nov 2026':'Q3 FY2026-27','Dec 2026':'Q3 FY2026-27','Jan 2027':'Q4 FY2026-27','Feb 2027':'Q4 FY2026-27','Mar 2027':'Q4 FY2026-27'};
    return map[period]||'Q2 FY2026-27';
  }
  function monthRole(period){
    if(['Apr 2026','Jul 2026','Oct 2026','Jan 2027'].includes(period))return 'M1';
    if(['May 2026','Aug 2026','Nov 2026','Feb 2027'].includes(period))return 'M2';
    return 'M3';
  }
  window.gstQrmpQuarterFor=quarterFor;
  window.gstQrmpMonthRole=monthRole;

  // Returns Dashboard: same portal shell, but with the correct quarterly return periods.
  const _baseReturnsDashboardBody=window.gstReturnsDashboardBody;
  window.gstReturnsDashboardBody=function(){
    const p=gstRead('gstTaxpayer',GST_DEMO);
    if(p.frequency!=='Quarterly') return _baseReturnsDashboardBody();
    return `<div class="gst-dash-head"><h2>Returns Dashboard</h2><div class="gst-dash-meta"><span>GSTIN: <b>${esc(p.gstin)}</b></span><span>Legal Name: <b>${esc(p.legalName)}</b></span><span>Filing Frequency: <b>Quarterly (QRMP)</b></span><span>Taxpayer Type: <b>${esc(p.taxpayerType)}</b></span></div></div>
    <div class="gst-alert info"><b>Returns Dashboard</b><br>Select the Financial Year and Return Filing Period and click <b>SEARCH</b>. For a QRMP taxpayer, IFF is available only for Month 1 and Month 2 of a quarter. The quarterly GSTR-1 is furnished for Month 3.</div>
    <div class="gst-filter-bar">
      <div><label>Financial Year</label><select id="gstFY"><option>2026-27</option><option>2025-26</option><option>2024-25</option></select></div>
      <div><label>Return Filing Period</label><select id="gstPeriod"><option>Jul 2026</option><option>Aug 2026</option><option>Sep 2026</option><option>Apr 2026</option><option>May 2026</option><option>Jun 2026</option></select></div>
      <div><label>Return Type</label><select id="gstReturnType"><option>All Returns</option><option>GSTR-1</option><option>IFF</option><option>GSTR-1A</option><option>GSTR-2B</option><option>GSTR-3B</option></select></div>
      <button class="gst-action" onclick="gstSearchReturns()">SEARCH</button>
    </div>
    <div id="gstReturnResults"><div class="gst-empty">Select the Financial Year and Return Filing Period, then click SEARCH.</div></div>`;
  };

  const _baseSearchReturnsQrmp=window.gstSearchReturns;
  window.gstSearchReturns=function(){
    const p=gstRead('gstTaxpayer',GST_DEMO);
    if(p.frequency!=='Quarterly') return _baseSearchReturnsQrmp();
    const fy=document.getElementById('gstFY')?.value||'2026-27';
    const period=document.getElementById('gstPeriod')?.value||'Jul 2026';
    const type=document.getElementById('gstReturnType')?.value||'All Returns';
    const role=monthRole(period), q=quarterFor(period);
    const iff=role==='M1'||role==='M2';
    const iffData=typeof gstIFFData==='function'?gstIFFData(period):{status:'Not Filed',records:[]};
    const g1=typeof gstGstr1Data==='function'?gstGstr1Data():{status:'Draft',invoices:[]};
    const tiles=[];
    if(iff) tiles.push(['IFF','Invoice Furnishing Facility — QRMP '+role,'13th of succeeding month',period,iffData.status||'Not Filed',iffData.status==='Filed'?'VIEW':'PREPARE ONLINE']);
    if(role==='M3') tiles.push(['GSTR-1','Quarterly Outward Supplies — M3','13th of month following quarter',period,g1.status||'Not Filed',g1.status==='Filed'?'VIEW':'PREPARE ONLINE']);
    else tiles.push(['GSTR-1','Quarterly Outward Supplies — Quarter end filing','13th of month following quarter',q,'Scheduled / Not Due','VIEW']);
    tiles.push(['GSTR-1A','Amendment / correction facility','As applicable',period,'Available','OPEN']);
    tiles.push(['GSTR-2A','Dynamic (view-only) ITC statement',(gst2ABuild&&Object.values(gst2ABuild().totals).reduce((s,t)=>s+t.count,0))+' records so far',period,'Available','OPEN']);
    tiles.push(['GSTR-2B','Auto-drafted ITC statement',role==='M1'||role==='M2'?'Quarterly cycle':'14th of succeeding month',period,'Available','VIEW']);
    tiles.push(['GSTR-3B','Summary return / tax payment','22nd of month following quarter',q,'Not Filed','PREPARE ONLINE']);
    tiles.push(['GSTR-9','Annual Return','31-Dec following FY',fy,'Not Filed','VIEW']);
    tiles.push(['GSTR-9C','Reconciliation Statement','As applicable',fy,'Not Filed','VIEW']);
    const shown=type==='All Returns'?tiles:tiles.filter(x=>x[0]===type);
    document.getElementById('gstReturnResults').innerHTML=`<div class="gst-section-title">Returns for ${esc(fy)} — ${esc(period)} <span style="font-weight:400">(${esc(q)} / ${esc(role)})</span></div><div class="gst-tile-grid">${shown.map(x=>gstReturnTile(x[0],x[1],x[2],x[3],x[4],x[5],`gstOpenReturn('${x[0]}')`)).join('')}</div>`;
  };

  /* ===== Opt-in for Quarterly Return (QRMP) — dedicated real-portal page, didn't exist before ===== */
  window.gstQrmpOptIn=function(){
    if(!gstRequireLogin('Opt-in for Quarterly Return'))return;
    const p=gstRead('gstTaxpayer',GST_DEMO);
    const turnover=gstRead('gstAggregateTurnoverPrevFY',450); // in lakhs, simulated
    const eligible=turnover<=500;
    feature('Opt-in for Quarterly Return','Services > Returns > Opt-in for Quarterly Return',`
      <div class="gst-alert info"><b>QRMP Scheme</b><br>Taxpayers with aggregate annual turnover up to <b>₹5 crore</b> in the preceding financial year may opt to file GSTR-1 and GSTR-3B quarterly, with tax paid monthly via PMT-06. Every registered person is Monthly by default.</div>
      <table class="gst-table"><tr><th>GSTIN</th><td>${esc(p.gstin)}</td><th>Legal Name</th><td>${esc(p.legalName)}</td></tr>
      <tr><th>Aggregate Turnover, Preceding FY (simulated)</th><td colspan="3">₹${turnover.toLocaleString('en-IN')} lakh — ${eligible?'<span class="gst-status green">Eligible for QRMP</span>':'<span class="gst-status orange">Not eligible (exceeds ₹5 crore)</span>'}</td></tr>
      <tr><th>Current Filing Frequency</th><td colspan="3"><b>${esc(p.frequency||'Monthly')}</b></td></tr></table>
      <div class="gst-section-title">Choose Filing Frequency for ${esc(gstReturnContext().fy)}</div>
      <div class="gst-form-grid"><div class="full"><label><input type="radio" name="qrmpFreq" value="Monthly" ${p.frequency!=='Quarterly'?'checked':''}> <b>Monthly</b> — file GSTR-1 and GSTR-3B every month (default)</label></div>
      <div class="full"><label><input type="radio" name="qrmpFreq" value="Quarterly" ${p.frequency==='Quarterly'?'checked':''} ${eligible?'':'disabled'}> <b>Quarterly (QRMP)</b> — file GSTR-1 and GSTR-3B once a quarter, with IFF available in the first two months ${eligible?'':' (not eligible this FY)'}</label></div></div>
      <div class="gst-action-row"><button class="gst-action" onclick="gstQrmpOptInConfirm()">CONFIRM</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK TO RETURNS DASHBOARD</button></div>
      <div class="gst-note">Training simulator: option can be changed at any time here to demonstrate both filing experiences; the real portal restricts changes to specific windows each quarter.</div>`);
  };
  window.gstQrmpOptInConfirm=function(){
    const choice=document.querySelector('[name="qrmpFreq"]:checked')?.value||'Monthly';
    const p=gstRead('gstTaxpayer',GST_DEMO);
    p.frequency=choice; gstWrite('gstTaxpayer',p);
    notify('Filing frequency set to '+choice+'.');
    openReturnsDashboard();
  };

  // IFF storage is isolated by FY + month and never touches GSTR-1 draft state.
  window.gstIFFKey=function(period){const fy=document.getElementById('gstFY')?.value||localStorage.getItem('gstReturnFY')||'2026-27';return 'gstIFF_'+fy+'_'+String(period).replace(/[^A-Za-z0-9]/g,'_')};
  window.gstIFFData=function(period){return gstRead(gstIFFKey(period),{status:'Draft',records:[],notes:[],savedAt:null,submittedAt:null,filedAt:null,summaryAt:null,reference:null})};
  function saveIFF(d,period){gstWrite(gstIFFKey(period),d)}
  function iffTax(taxable,rate,pos){return gstTaxCalc(taxable,rate,pos)}
  function iffSummary(d){return (d.records||[]).reduce((a,x)=>{a.count++;a.taxable+=+x.taxable||0;a.igst+=+x.igst||0;a.cgst+=+x.cgst||0;a.sgst+=+x.sgst||0;return a},{count:0,taxable:0,igst:0,cgst:0,sgst:0})}
  function iffRole(period){return monthRole(period)}

  window.gstOpenIFF=function(){
    if(!gstRequireLogin('IFF'))return;
    const c=gstReturnContext(),role=iffRole(c.period);
    if(role==='M3'){
      return feature('Invoice Furnishing Facility (IFF)','Services > Returns > Returns Dashboard > IFF',`<div class="gst-alert warning"><b>IFF is not available for Month 3.</b><br>For a QRMP taxpayer, IFF is available only for the first two months of each quarter. Report remaining outward supplies in the quarterly GSTR-1 for Month 3.</div><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK TO RETURNS DASHBOARD</button>`);
    }
    feature('Invoice Furnishing Facility (IFF)','Services > Returns > Returns Dashboard > IFF',gstIFFBody(c));
  };

  window.gstIFFBody=function(c){
    const d=gstIFFData(c.period),s=iffSummary(d),role=iffRole(c.period),q=quarterFor(c.period);
    const due=role==='M1'?(c.period==='Jul 2026'?'13-Aug-2026':'13th of succeeding month'):(c.period==='Aug 2026'?'13-Sep-2026':'13th of succeeding month');
    const frozen=d.status==='Submitted'||d.status==='Filed';
    return `<div class="gst-dash-head"><h2>Invoice Furnishing Facility (IFF)</h2><div class="gst-dash-meta"><span>Financial Year: <b>${esc(c.fy)}</b></span><span>Quarter: <b>${esc(q)}</b></span><span>Month: <b>${esc(c.period)} (${esc(role)})</b></span><span>Status: <b>${esc(d.status)}</b></span></div></div>
    <div class="gst-alert info"><b>QRMP / IFF</b><br>IFF is an optional facility for quarterly taxpayers for M1 and M2 to furnish specified outward-supply documents and pass credit to recipients. IFF records filed here flow to the recipient's simulated GSTR-2B and do not need to be re-entered in the quarterly GSTR-1.</div>
    <div class="gst-section-title">IFF Preparation Status</div><div class="gst-summary-grid"><div class="gst-summary"><div class="label">Documents</div><div class="value">${s.count}</div><div class="sub">Current IFF month</div></div><div class="gst-summary"><div class="label">Taxable Value</div><div class="value">${gstMoney(s.taxable)}</div><div class="sub">B2B / permitted records</div></div><div class="gst-summary"><div class="label">IGST</div><div class="value">${gstMoney(s.igst)}</div><div class="sub">Calculated</div></div><div class="gst-summary"><div class="label">CGST + SGST</div><div class="value">${gstMoney(s.cgst+s.sgst)}</div><div class="sub">Calculated</div></div></div>
    <div class="gst-alert warning"><b>Due / expiry:</b> ${esc(due)}. IFF is optional; after the IFF due date, new records cannot be saved/submitted for that month. Submitted records must still be filed. A submitted IFF is mandatory to file once submitted.</div>
    <div class="gst-section-title">Applicable IFF Tables</div><div class="gst-tile-grid">
      ${[['B2B / SEZ / Deemed Exports','4A, 4B, 4C, 6B, 6C','gstIFFB2B()'],['Credit / Debit Notes (Registered)','9B — CDNR','gstIFFCDNR()'],['Amended B2B Invoices','9A — B2BA','gstIFFAmend()'],['Amended Credit / Debit Notes','9C — CDNRA','gstIFFAmendNotes()'],['Supplies u/s 9(5)','15 — ECO supplies','gstIFFNineFive()'],['Amended 9(5) Supplies','15A — amended ECO supplies','gstIFFNineFiveAmend()']].map(t=>`<div class="gst-return-tile"><div class="rt-head">${t[0]}</div><div class="rt-body"><div class="rt-row"><span>Tables</span><b>${t[1]}</b></div><div class="rt-actions"><button class="gst-action" onclick="${frozen?'notify(\'IFF is frozen after submission\')':t[2]}">OPEN</button></div></div></div>`).join('')}
    </div>
    <div class="gst-section-title">IFF Actions</div><div class="gst-action-row"><button class="gst-action" onclick="gstIFFGenerateSummary()">GENERATE IFF SUMMARY</button><button class="gst-action secondary" onclick="gstIFFPreview()">PREVIEW IFF</button><button class="gst-action" onclick="gstIFFSubmit()">SUBMIT</button><button class="gst-action" onclick="gstIFFFiling()">FILE WITH EVC / DSC</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK</button></div><div id="gstIFFMsg" class="demo-note"></div>`;
  };

  window.gstIFFB2B=function(){
    const c=gstReturnContext(),d=gstIFFData(c.period),rows=(d.records||[]).filter(x=>x.table==='B2B').map((x,i)=>`<tr><td>${esc(x.invoiceNo)}</td><td>${esc(x.invoiceDate)}</td><td>${esc(x.recipientGstin)}</td><td>${esc(x.pos)}</td><td>${gstMoney(x.taxable)}</td><td>${gstMoney((+x.igst||0)+(+x.cgst||0)+(+x.sgst||0))}</td><td><button class="gst-action secondary" onclick="gstIFFDelete(${i})">DELETE</button></td></tr>`).join('')||'<tr><td colspan="7">No IFF B2B records saved.</td></tr>';
    feature('IFF — B2B / SEZ / Deemed Exports','IFF > Tables 4A, 4B, 4C, 6B, 6C',`<div class="gst-alert info">Add permitted B2B / SEZ / deemed-export invoice details for the selected QRMP month.</div><div class="gst-form-grid"><div><label>Recipient GSTIN *</label><input id="iffGstin" class="f-input" maxlength="15"></div><div><label>Invoice Number *</label><input id="iffInv" class="f-input"></div><div><label>Invoice Date *</label><input id="iffDate" type="date" class="f-input"></div><div><label>Place of Supply *</label><select id="iffPos" class="f-select"><option>Intra-State</option><option>Inter-State</option></select></div><div><label>Supply Category *</label><select id="iffCat" class="f-select"><option>B2B</option><option>SEZ</option><option>Deemed Export</option></select></div><div><label>Taxable Value *</label><input id="iffTaxable" type="number" min="0" step="0.01" class="f-input"></div><div><label>Tax Rate *</label><select id="iffRate" class="f-select"><option>5</option><option selected>18</option><option>40</option></select></div><div><label>HSN/SAC *</label><input id="iffHsn" class="f-input"></div></div><div class="gst-action-row"><button class="gst-action" onclick="gstIFFAddB2B()">ADD / SAVE</button><button class="gst-action secondary" onclick="gstOpenIFF()">BACK TO IFF</button></div><div id="iffB2BMsg" class="demo-note"></div><div class="gst-section-title">Saved Records</div><table class="gst-table"><thead><tr><th>Invoice</th><th>Date</th><th>Recipient GSTIN</th><th>POS</th><th>Taxable</th><th>Tax</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>`);
  };
  window.gstIFFAddB2B=function(){
    const c=gstReturnContext(),d=gstIFFData(c.period),m=document.getElementById('iffB2BMsg');
    if(d.status!=='Draft'){m.innerHTML='<span style="color:#9a2f2f">IFF is frozen after submission.</span>';return}
    const v={gstin:document.getElementById('iffGstin')?.value.trim().toUpperCase()||'',inv:document.getElementById('iffInv')?.value.trim()||'',date:document.getElementById('iffDate')?.value||'',pos:document.getElementById('iffPos')?.value||'Intra-State',cat:document.getElementById('iffCat')?.value||'B2B',taxable:+document.getElementById('iffTaxable')?.value||0,rate:+document.getElementById('iffRate')?.value||0,hsn:document.getElementById('iffHsn')?.value.trim()||''};
    if(!/^([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9])$/.test(v.gstin)&&v.gstin!=='32ABCDE1234F1Z5'){m.innerHTML='<span style="color:#9a2f2f">Enter a valid GSTIN-format recipient GSTIN.</span>';return}
    if(!v.inv||!v.date||v.taxable<=0||!v.hsn){m.innerHTML='<span style="color:#9a2f2f">Complete all mandatory fields.</span>';return}
    if(d.records.some(x=>x.table==='B2B'&&x.invoiceNo.toUpperCase()===v.inv.toUpperCase())){m.innerHTML='<span style="color:#9a2f2f">Duplicate invoice number detected in this IFF month.</span>';return}
    const t=iffTax(v.taxable,v.rate,v.pos);d.records.push({id:'IFF-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),table:'B2B',category:v.cat,recipientGstin:v.gstin,invoiceNo:v.inv,invoiceDate:v.date,pos:v.pos,taxable:v.taxable,rate:v.rate,igst:t.igst,cgst:t.cgst,sgst:t.sgst,hsn:v.hsn,savedAt:new Date().toISOString()});d.savedAt=new Date().toISOString();saveIFF(d,c.period);gstIFFB2B();
  };
  window.gstIFFDelete=function(index){const c=gstReturnContext(),d=gstIFFData(c.period);const list=d.records.filter(x=>x.table==='B2B');const target=list[index];if(!target)return;d.records=d.records.filter(x=>x!==target);saveIFF(d,c.period);gstIFFB2B()};

  function iffSimpleTable(title,table,fields){
    const c=gstReturnContext(),d=gstIFFData(c.period),m=table;
    feature(title,'IFF > '+table,`<div class="gst-alert info">Training workspace for ${esc(table)}. Only the applicable IFF tables are enabled for M1/M2.</div><div class="gst-form-grid">${fields.map(f=>`<div><label>${f[0]}${f[2]?' *':''}</label><input id="iff_${table.replace(/[^A-Za-z0-9]/g,'')}_${f[1]}" class="f-input" ${f[2]?'required':''}></div>`).join('')}</div><div class="gst-action-row"><button class="gst-action" onclick="gstIFFSaveSimple('${table}')">SAVE</button><button class="gst-action secondary" onclick="gstOpenIFF()">BACK TO IFF</button></div><div id="iffSimpleMsg" class="demo-note"></div><div class="gst-section-title">Saved ${esc(table)} Records</div><table class="gst-table"><thead><tr><th>Reference</th><th>Description</th><th>Taxable</th><th>Tax</th></tr></thead><tbody>${d.records.filter(x=>x.table===table).map(x=>`<tr><td>${esc(x.ref||'-')}</td><td>${esc(x.description||'-')}</td><td>${gstMoney(x.taxable)}</td><td>${gstMoney((+x.igst||0)+(+x.cgst||0)+(+x.sgst||0))}</td></tr>`).join('')||'<tr><td colspan="4">No records.</td></tr>'}</tbody></table>`);
  }
  window.gstIFFCDNR=function(){iffSimpleTable('IFF — Credit / Debit Notes (Registered)','9B — CDNR',[['Reference / Note No.','ref',true],['Description','description',true],['Taxable Value','taxable',true],['Tax Amount','tax',true]])};
  window.gstIFFAmend=function(){iffSimpleTable('IFF — Amended B2B Invoices','9A — B2BA',[['Original Invoice No.','ref',true],['Amendment Reason','description',true],['Taxable Value','taxable',true],['Tax Amount','tax',true]])};
  window.gstIFFAmendNotes=function(){iffSimpleTable('IFF — Amended Credit / Debit Notes','9C — CDNRA',[['Original Note No.','ref',true],['Amendment Reason','description',true],['Taxable Value','taxable',true],['Tax Amount','tax',true]])};
  window.gstIFFNineFive=function(){iffSimpleTable('IFF — Supplies through E-Commerce Operator','15 — Section 9(5)',[['Reference','ref',true],['Description','description',true],['Taxable Value','taxable',true],['Tax Amount','tax',true]])};
  window.gstIFFNineFiveAmend=function(){iffSimpleTable('IFF — Amended Section 9(5) Supplies','15A — Amendment', [['Original Reference','ref',true],['Amendment Reason','description',true],['Taxable Value','taxable',true],['Tax Amount','tax',true]])};
  window.gstIFFSaveSimple=function(table){
    const c=gstReturnContext(),d=gstIFFData(c.period),msg=document.getElementById('iffSimpleMsg');
    if(d.status!=='Draft'){msg.innerHTML='<span style="color:#9a2f2f">IFF is frozen after submission.</span>';return}
    const key=table.replace(/[^A-Za-z0-9]/g,'');const ref=document.getElementById('iff_'+key+'_ref')?.value.trim()||'';const desc=document.getElementById('iff_'+key+'_description')?.value.trim()||'';const taxable=+document.getElementById('iff_'+key+'_taxable')?.value||0;const tax=+document.getElementById('iff_'+key+'_tax')?.value||0;
    if(!ref||!desc||taxable<=0||tax<0){msg.innerHTML='<span style="color:#9a2f2f">Complete the mandatory fields with valid amounts.</span>';return}
    d.records.push({id:'IFFS-'+Date.now(),table,ref,description:desc,taxable,tax,igst:tax,cgst:0,sgst:0,savedAt:new Date().toISOString()});d.savedAt=new Date().toISOString();saveIFF(d,c.period);iffSimpleTable('IFF — '+table,table,[['Reference','ref',true],['Description','description',true],['Taxable Value','taxable',true],['Tax Amount','tax',true]]);
  };

  window.gstIFFGenerateSummary=function(){const c=gstReturnContext(),d=gstIFFData(c.period),s=iffSummary(d);d.summaryAt=new Date().toISOString();saveIFF(d,c.period);feature('IFF Summary','Services > Returns > IFF > Generate IFF Summary',`<div class="gst-alert success"><b>IFF Summary generated successfully.</b> This is a simulated training summary.</div><table class="gst-table"><tr><th>Quarter</th><td>${esc(quarterFor(c.period))}</td><th>Month</th><td>${esc(c.period)} (${esc(monthRole(c.period))})</td></tr><tr><th>Documents</th><td>${s.count}</td><th>Taxable Value</th><td>${gstMoney(s.taxable)}</td></tr><tr><th>IGST</th><td>${gstMoney(s.igst)}</td><th>CGST</th><td>${gstMoney(s.cgst)}</td></tr><tr><th>SGST</th><td>${gstMoney(s.sgst)}</td><th>Status</th><td>${esc(d.status)}</td></tr></table><div class="gst-action-row"><button class="gst-action secondary" onclick="gstOpenIFF()">BACK TO IFF</button></div>`)};
  window.gstIFFPreview=function(){const c=gstReturnContext(),d=gstIFFData(c.period);feature('Preview IFF','Services > Returns > IFF > Preview',`<div class="gst-alert info">Preview of the IFF data for ${esc(c.period)}. Preview does not submit or file the statement.</div><table class="gst-table"><thead><tr><th>Table</th><th>Reference</th><th>Description</th><th>Taxable</th><th>Tax</th></tr></thead><tbody>${d.records.map(x=>`<tr><td>${esc(x.table)}</td><td>${esc(x.invoiceNo||x.ref||'-')}</td><td>${esc(x.description||x.category||'-')}</td><td>${gstMoney(x.taxable)}</td><td>${gstMoney((+x.igst||0)+(+x.cgst||0)+(+x.sgst||0))}</td></tr>`).join('')||'<tr><td colspan="5">No records saved.</td></tr>'}</tbody></table><div class="gst-action-row"><button class="gst-action secondary" onclick="gstOpenIFF()">BACK TO IFF</button></div>`)};
  window.gstIFFSubmit=function(){
    const c=gstReturnContext(),d=gstIFFData(c.period),m=document.getElementById('gstIFFMsg');
    if(d.status!=='Draft'){if(m)m.innerHTML='<span style="color:#9a2f2f">IFF is already submitted/filed.</span>';return}
    if(!d.records.length){if(m)m.innerHTML='<span style="color:#9a2f2f">Save at least one applicable IFF record before SUBMIT.</span>';return}
    d.status='Submitted';d.submittedAt=new Date().toISOString();d.reference='SIM-IFF-'+Date.now().toString().slice(-10);saveIFF(d,c.period);
    try{const st=gstRead('gstSupplierRecords',[]);d.records.forEach(r=>{st.push({supplierGstin:GST_DEMO.gstin,supplierName:GST_DEMO.legalName,invoiceNo:r.invoiceNo||r.ref||r.id,invoiceDate:r.invoiceDate||new Date().toISOString().slice(0,10),type:r.table==='B2B'?'B2B Invoice':'Credit/Debit Note',source:'IFF',taxable:r.taxable,igst:r.igst||r.tax||0,cgst:r.cgst||0,sgst:r.sgst||0,action:'No Action',itcEligible:true});});gstWrite('gstSupplierRecords',st)}catch(e){}
    gstOpenIFF();
  };
  window.gstIFFFiling=function(){
    const c=gstReturnContext(),d=gstIFFData(c.period);
    if(d.status!=='Submitted'){notify('Submit the IFF before filing it.');return}
    const ref=d.reference||'SIM-IFF-'+Date.now().toString().slice(-10);const body=`<div class="gst-alert info"><b>File IFF</b><br>Choose the simulated filing method. The actual GST Portal provides DSC and EVC filing options.</div><div class="gst-section-title">Filing Declaration</div><div class="gst-form-grid"><div><label>Authorized Signatory *</label><input id="iffSigner" class="f-input" value="Demo Authorized Signatory"></div><div><label>Filing Method</label><select id="iffFileMethod" class="f-select"><option>EVC</option><option>DSC</option></select></div><div><label>Demo OTP / PIN *</label><input id="iffFileOtp" class="f-input" maxlength="6" value="123456"></div></div><div class="gst-action-row"><button class="gst-action" onclick="gstIFFConfirmFile()">FILE IFF</button><button class="gst-action secondary" onclick="gstOpenIFF()">BACK</button></div><div class="demo-note">Training only. Reference before filing: ${esc(ref)}</div>`;
    feature('File IFF','Services > Returns > IFF > File',body);
  };
  window.gstIFFConfirmFile=function(){const c=gstReturnContext(),d=gstIFFData(c.period),s=document.getElementById('iffSigner')?.value.trim(),otp=document.getElementById('iffFileOtp')?.value.trim();if(!s||otp!=='123456'){notify('Enter the authorized signatory and simulated OTP 123456.');return}d.status='Filed';d.filedAt=new Date().toISOString();d.reference='SIM-ARN-IFF-'+Date.now().toString().slice(-10);saveIFF(d,c.period);try{const st=gstRead('gstLedgerState',{audit:[]});st.audit=st.audit||[];st.audit.push({at:new Date().toISOString(),user:'Demo Taxpayer',module:'Returns',action:'FILE IFF',reference:d.reference,detail:'IFF '+c.period+' filed by simulated '+(document.getElementById('iffFileMethod')?.value||'EVC')});gstWrite('gstLedgerState',st)}catch(e){};feature('IFF Filed','Services > Returns > View e-Filed Returns',`<div class="gst-alert success"><b>IFF filed successfully.</b><br>Simulated ARN: <b>${esc(d.reference)}</b></div><table class="gst-table"><tr><th>Quarter</th><td>${esc(quarterFor(c.period))}</td><th>Month</th><td>${esc(c.period)} (${esc(monthRole(c.period))})</td></tr><tr><th>Filing Method</th><td>${esc(document.getElementById('iffFileMethod')?.value||'EVC')}</td><th>Status</th><td><span class="gst-status green">Filed</span></td></tr><tr><th>Filing Date</th><td>${new Date().toLocaleString('en-IN')}</td><th>ARN</th><td>${esc(d.reference)}</td></tr></table><div class="gst-action-row"><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK TO RETURNS DASHBOARD</button></div>`)};

  // Make IFF accessible from the same return tile/router used by the existing portal shell.
  const originalOpenReturn=window.gstOpenReturn;
  window.gstOpenReturn=function(name){
    if(name==='IFF') return gstOpenIFF();
    if(name==='GSTR-1' && typeof gstOpenGstr1==='function') return gstOpenGstr1();
    return originalOpenReturn(name);
  };
  const originalFeatureNav=window.featureNav;
  window.featureNav=function(label){
    if(label==='IFF') return gstOpenIFF();
    if(label==='QRMP') return openReturnsDashboard();
    return originalFeatureNav(label);
  };

  // Ensure the sidebar's IFF/QRMP service item opens the connected workflow if present.
  document.addEventListener('click',function(e){
    const el=e.target.closest && e.target.closest('[data-feature]');
    if(el && /IFF|QRMP/i.test(el.getAttribute('data-feature')||'')){
      e.preventDefault(); e.stopPropagation(); gstOpenIFF();
    }
  },true);
})();


/* ===== Annual Return Module: GSTR-9 / GSTR-9C =====
   Built on the existing GST portal shell; no replacement UI. */
(function(){
  const origOpenReturn=window.gstOpenReturn;
  const annualKey=(fy)=>'gstGSTR9_'+fy;
  const reconKey=(fy)=>'gstGSTR9C_'+fy;
  function annualDefault(fy){
    const z5={taxable:0,igst:0,cgst:0,sgst:0,cess:0};
    const zITC={igst:0,cgst:0,sgst:0,cess:0};
    return {fy,status:'Not Started',nil:null,tiles:{},data:{
      // Table 4: advances, inward and outward supplies on which tax IS payable (real lettered rows 4A–4N)
      t4:{A:{...z5},B:{...z5},C:{...z5},D:{...z5},E:{...z5},F:{...z5},G:{...z5},I:{...z5},J:{...z5},K:{...z5},L:{...z5}},
      // Table 5: outward supplies on which tax is NOT payable (5A–5N)
      t5:{A:{...z5},B:{...z5},C:{...z5},D:{...z5},E:{...z5},F:{...z5},H:{...z5},I:{...z5},J:{...z5},K:{...z5}},
      // Table 6: ITC availed (6A–6O)
      t6:{A:{...zITC},B:{...zITC},C:{...zITC},D:{...zITC},E:{...zITC},F:{...zITC},G:{...zITC},H:{...zITC},K:{...zITC},L:{...zITC},M:{...zITC}},
      // Table 7: ITC reversed / ineligible (7A–7J)
      t7:{A:{...zITC},B:{...zITC},C:{...zITC},D:{...zITC},E:{...zITC},F:{...zITC},G:{...zITC},H:{...zITC}},
      // Table 8: other ITC related information (8A–8K)
      t8:{B_extra:{...zITC},C:{...zITC},E:{...zITC},F:{...zITC},G:{...zITC},H:{...zITC},J:{...zITC}},
      t9:{taxPayable:0,taxPaid:0,interest:0,lateFee:0,penalty:0,others:0},
      t9rows:{igst:{payable:0,paid:0},cgst:{payable:0,paid:0},sgst:{payable:0,paid:0},cess:{payable:0,paid:0},interest:{payable:0,paid:0},lateFee:{payable:0,paid:0},penalty:{payable:0,paid:0},other:{payable:0,paid:0}},
      t10:{...z5},t11:{...z5},
      t12:{...zITC},t13:{...zITC},
      t14:{payable:0,paid:0},
      t15:{refundClaimed:0,refundSanctioned:0,refundRejected:0,refundPending:0,demandTaxes:0,demandPaid:0,demandPending:0},
      t16:{composition:{...z5},deemedSupply:{...z5},goodsSentApproval:{...z5}},
      t17:[],t18:[],
      t19:{lateFeeCgstPayable:0,lateFeeCgstPaid:0,lateFeeSgstPayable:0,lateFeeSgstPaid:0}
    },computed:false,ready:false,lateFee:0,additionalLiability:0,arn:'',filedAt:''}};
  // Real Table 4/5/6/7/8 lettered-row schema, matching the actual GSTR-9 form.
  const G9_T4_ROWS=[
    ['A','Supplies made to un-registered persons (B2C)',true],
    ['B','Supplies made to registered persons (B2B)',true],
    ['C','Zero rated supply (Export) on payment of tax (except supplies to SEZs)',true],
    ['D','Supply to SEZs on payment of tax',true],
    ['E','Deemed Exports',true],
    ['F','Advances on which tax has been paid but invoice has not been issued',true],
    ['G','Inward supplies on which tax is to be paid on reverse charge basis',true],
    ['H','Sub-total (A to G above)',false],
    ['I','Credit Notes issued in respect of transactions specified in B to E above (-)',true],
    ['J','Debit Notes issued in respect of transactions specified in B to E above (+)',true],
    ['K','Supplies / tax declared through Amendments (+)',true],
    ['L','Supplies / tax reduced through Amendments (-)',true],
    ['M','Sub-total (I to L above)',false],
    ['N','Supplies and advances on which tax is to be paid (H + M above)',false]
  ];
  const G9_T5_ROWS=[
    ['A','Zero rated supply (Export) without payment of tax',true],
    ['B','Supply to SEZs without payment of tax',true],
    ['C','Supplies on which tax is to be paid by the recipient on reverse charge basis',true],
    ['D','Exempted',true],
    ['E','Nil Rated',true],
    ['F','Non-GST supply',true],
    ['G','Sub-total (A to F above)',false],
    ['H','Credit Notes issued in respect of transactions specified in A to F above (-)',true],
    ['I','Debit Notes issued in respect of transactions specified in A to F above (+)',true],
    ['J','Supplies declared through Amendments (+)',true],
    ['K','Supplies reduced through Amendments (-)',true],
    ['L','Sub-Total (H to K above)',false],
    ['M','Turnover on which tax is not to be paid (G + L above)',false],
    ['N','Total Turnover (including advances) (4N + 5M – 4G above)',false]
  ];
  const G9_T6_ROWS=[
    ['A','Total ITC availed through FORM GSTR-3B (auto)',true],
    ['B','Inward supplies (other than imports and inward supplies liable to reverse charge but includes services received from SEZs)',true],
    ['C','Inward supplies received from unregistered persons liable to reverse charge (other than B above), tax paid & ITC availed',true],
    ['D','Inward supplies received from registered persons liable to reverse charge (other than B above), tax paid & ITC availed',true],
    ['E','Import of goods (including supplies from SEZs)',true],
    ['F','Import of services (excluding inward supplies from SEZs)',true],
    ['G','Input Tax credit received from ISD',true],
    ['H','Amount of ITC reclaimed (other than B above) under the provisions of the Act',true],
    ['I','Sub-total (B to H above)',false],
    ['J','Difference (I – A above)',false],
    ['K','Transition Credit through TRAN-I (including revisions, if any)',true],
    ['L','Transition Credit through TRAN-II',true],
    ['M','Any other ITC availed but not specified above',true],
    ['N','Sub-total (K to M above)',false],
    ['O','Total ITC availed (I + N above)',false]
  ];
  const G9_T7_ROWS=[
    ['A','As per Rule 37',true],['B','As per Rule 39',true],['C','As per Rule 42',true],['D','As per Rule 43',true],
    ['E','As per Section 17(5)',true],['F','Reversal of TRAN-I credit',true],['G','Reversal of TRAN-II credit',true],
    ['H','Other reversals (pl. specify)',true],['I','Total ITC Reversed (A to H above)',false],['J','Net ITC Available for Utilization (6O – 7I)',false]
  ];
  const G9_T8_ROWS=[
    ['A','ITC as per GSTR-2A (Table 3 & 5) — auto',false],
    ['B','ITC as per sum total of 6(B) and 6(H) above',false],
    ['C','ITC on inward supplies received during the FY but availed in the next FY (Apr–Sep / up to filing)',true],
    ['D','Difference [A – (B + C)]',false],
    ['E','ITC available but not availed',true],
    ['F','ITC available but ineligible',true],
    ['G','IGST paid on import of goods (including supplies from SEZ)',true],
    ['H','IGST credit availed on import of goods (as per 6(E) above)',false],
    ['I','Difference (G – H)',false],
    ['J','ITC available but not availed on import of goods',true],
    ['K','Total ITC to be lapsed in current FY (E + F + J)',false]
  ];
  function g9TableRows(n){return {4:G9_T4_ROWS,5:G9_T5_ROWS,6:G9_T6_ROWS,7:G9_T7_ROWS,8:G9_T8_ROWS}[n]||[]}
  function g9TableCols(n){return n>=6&&n<=8?['igst','cgst','sgst','cess']:['taxable','igst','cgst','sgst','cess']}
  function g9RowKey(n,code){
    if(n===8){ return code==='B'?'B_extra':code; } // 8B is a computed cross-ref, not its own stored field except where noted
    return code;
  }
  // Recompute every derived (non-editable) row from the editable ones, matching the real
  // GSTR-9 sub-total / cross-table formulas, whenever any tile is saved.
  function g9Recompute(fy){
    const d=getA(fy), t=d.data;
    const sum5=(...rows)=>{const o={taxable:0,igst:0,cgst:0,sgst:0,cess:0};rows.forEach(r=>{if(!r)return;o.taxable+=+r.taxable||0;o.igst+=+r.igst||0;o.cgst+=+r.cgst||0;o.sgst+=+r.sgst||0;o.cess+=+r.cess||0;});return o};
    const sumITC=(...rows)=>{const o={igst:0,cgst:0,sgst:0,cess:0};rows.forEach(r=>{if(!r)return;o.igst+=+r.igst||0;o.cgst+=+r.cgst||0;o.sgst+=+r.sgst||0;o.cess+=+r.cess||0;});return o};
    const diff5=(a,b)=>({taxable:(a.taxable||0)-(b.taxable||0),igst:(a.igst||0)-(b.igst||0),cgst:(a.cgst||0)-(b.cgst||0),sgst:(a.sgst||0)-(b.sgst||0),cess:(a.cess||0)-(b.cess||0)});
    const diffITC=(a,b)=>({igst:(a.igst||0)-(b.igst||0),cgst:(a.cgst||0)-(b.cgst||0),sgst:(a.sgst||0)-(b.sgst||0),cess:(a.cess||0)-(b.cess||0)});
    // Table 4
    const t4H=sum5(t.t4.A,t.t4.B,t.t4.C,t.t4.D,t.t4.E,t.t4.F,t.t4.G); t.t4.H=t4H;
    const t4M=sum5(t.t4.I,t.t4.J,t.t4.K,t.t4.L); t.t4.M=t4M;
    const t4N=sum5(t4H,t4M); t.t4.N=t4N;
    // Table 5
    const t5G=sum5(t.t5.A,t.t5.B,t.t5.C,t.t5.D,t.t5.E,t.t5.F); t.t5.G=t5G;
    const t5L=sum5(t.t5.H,t.t5.I,t.t5.J,t.t5.K); t.t5.L=t5L;
    const t5M=sum5(t5G,t5L); t.t5.M=t5M;
    const t5N=sum5(t4N,t5M); t5N.taxable-=(+t.t4.G.taxable||0); t5N.igst-=(+t.t4.G.igst||0); t5N.cgst-=(+t.t4.G.cgst||0); t5N.sgst-=(+t.t4.G.sgst||0); t5N.cess-=(+t.t4.G.cess||0); t.t5.N=t5N;
    // Table 6
    const t6I=sumITC(t.t6.B,t.t6.C,t.t6.D,t.t6.E,t.t6.F,t.t6.G,t.t6.H); t.t6.I=t6I;
    t.t6.J=diffITC(t6I,t.t6.A);
    const t6N=sumITC(t.t6.K,t.t6.L,t.t6.M); t.t6.N=t6N;
    const t6O=sumITC(t6I,t6N); t.t6.O=t6O;
    // Table 7
    const t7I=sumITC(t.t7.A,t.t7.B,t.t7.C,t.t7.D,t.t7.E,t.t7.F,t.t7.G,t.t7.H); t.t7.I=t7I;
    t.t7.J=diffITC(t6O,t7I);
    // Table 8 — 8A auto from this simulator's GSTR-2A data (a real, working cross-module pull)
    const g2a=(typeof gst2ABuild==='function')?gst2ABuild():null;
    const t8A=g2a?{igst:g2a.parts.b2b.reduce((s,x)=>s+(+x.igst||0),0),cgst:g2a.parts.b2b.reduce((s,x)=>s+(+x.cgst||0),0),sgst:g2a.parts.b2b.reduce((s,x)=>s+(+x.sgst||0),0),cess:0}:{igst:0,cgst:0,sgst:0,cess:0};
    t.t8.A=t8A;
    const t8B=sumITC(t.t6.B,t.t6.H); t.t8.B_extra=t8B;
    t.t8.D=diffITC(t8A,sumITC(t8B,t.t8.C));
    t.t8.H=t.t6.E;
    t.t8.I=diffITC(t.t8.G,t.t8.H);
    const t8K=sumITC(t.t8.E,t.t8.F,t.t8.J); t.t8.K=t8K;
    saveA(d);
    return d;
  }
  function g9RenderTableEditor(n,fy){
    const d=getA(fy), t=d.data;
    const rows=g9TableRows(n), cols=g9TableCols(n);
    const colLabels={taxable:'Taxable Value',igst:'Integrated Tax',cgst:'Central Tax',sgst:'State/UT Tax',cess:'Cess'};
    const titleMap={4:'Table 4 — Details of advances, inward and outward supplies made during the financial year on which tax is payable',5:'Table 5 — Details of Outward supplies made during the financial year on which tax is not payable',6:'Table 6 — Details of ITC availed during the financial year',7:'Table 7 — Details of ITC Reversed and Ineligible ITC for the financial year',8:'Table 8 — Other ITC related information'};
    const body=`<div class="gst-alert info"><b>${esc(titleMap[n])}</b><br>Rows marked <i>auto-computed</i> are derived from the other rows in this table (and, where noted, from other tables/modules) and cannot be edited directly, matching how the real portal locks these sub-totals.</div>
      <div class="gst-table-wrap"><table class="gst-table g9-table"><thead><tr><th>Sl</th><th>Description</th>${cols.map(c=>`<th>${colLabels[c]}</th>`).join('')}</tr></thead><tbody>
      ${rows.map(([code,label,editable])=>{
        const key=g9RowKey(n,code); const row=t['t'+n][key]||{};
        return `<tr class="${editable?'':'g9-computed-row'}"><td><b>${n}${code}</b></td><td>${esc(label)}</td>${cols.map(c=>editable?`<td><input type="number" class="f-input g9cell" data-t="${n}" data-code="${code}" data-col="${c}" value="${row[c]||0}"></td>`:`<td>${money(row[c]||0)}</td>`).join('')}</tr>`;
      }).join('')}
      </tbody></table></div>
      <div class="gst-action-row"><button class="gst-action" onclick="g9SaveTableN(${n})">SAVE</button><button class="gst-action secondary" onclick="g9Open('${esc(fy)}')">BACK TO GSTR-9 DASHBOARD</button></div><div id="g9tilemsg" class="demo-note"></div>`;
    feature(titleMap[n]||('Table '+n),'GSTR-9 > Table '+n,body);
  }
  window.g9SaveTableN=function(n){
    const fy=annualFY(),d=getA(fy);
    document.querySelectorAll(`.g9cell[data-t="${n}"]`).forEach(el=>{
      const code=el.dataset.code,col=el.dataset.col,key=g9RowKey(n,code);
      d.data['t'+n][key]=d.data['t'+n][key]||{}; d.data['t'+n][key][col]=+el.value||0;
    });
    d.status='In Progress'; saveA(d);
    g9Recompute(fy);
    notify('Table '+n+' saved and sub-totals recomputed.');
    g9Open(fy);
  };
  function getA(fy){return gstRead(annualKey(fy),annualDefault(fy));}
  function saveA(d){gstWrite(annualKey(d.fy),d);}
  function reconDefault(fy){return {fy,status:'Not Started',books:{turnover:0,taxable:0,igst:0,cgst:0,sgst:0,cess:0,taxPaid:0,itc:0},gst:{turnover:0,taxable:0,igst:0,cgst:0,sgst:0,cess:0,taxPaid:0,itc:0},differences:{},notes:'',certification:'Not Started',arn:'',filedAt:''};}
  function getC(fy){return gstRead(reconKey(fy),reconDefault(fy));}
  function saveC(d){gstWrite(reconKey(d.fy),d);}
  function money(n){return gstMoney(+n||0)}
  function num(id){return +(document.getElementById(id)?.value||0)||0}
  let currentAnnualFY='2025-26';
  function annualFY(){return currentAnnualFY}
  function tile(title,desc,value,action){return `<div class="gst-return-tile"><div class="rt-head">${title}</div><div class="rt-body"><div class="rt-row"><span>${desc}</span><b>${value}</b></div><div class="rt-actions">${action}</div></div></div>`}
  function dataFromReturns(fy){
    const invoices=gstRead('gstInvoices',[]); const filed=gstRead('gstFiledReturns',[]); const g1=invoices.filter(x=>String(x.fy||fy)===fy);
    let taxable=0,igst=0,cgst=0,sgst=0,cess=0; g1.forEach(x=>{taxable+=+x.taxableValue||+x.taxable||0;igst+=+x.igst||0;cgst+=+x.cgst||0;sgst+=+x.sgst||0;cess+=+x.cess||0});
    const g3=Array.isArray(filed)?filed.filter(x=>x.form==='GSTR-3B'&&String(x.fy||fy)===fy):[];
    const itc=gstRead('gstCreditLedger',{balance:0}); const credit=+(itc.balance||itc.closingBalance||0)||0;
    return {taxable,igst,cgst,sgst,cess,g3:g3.length,itc:credit};
  }
  function annualBody(fy){
    const d=getA(fy), src=dataFromReturns(fy), filed=d.status==='Filed';
    const s=d.data; const t4=s.t4.N||{taxable:0}, t6=s.t6.O||{igst:0,cgst:0,sgst:0,cess:0}, t7=s.t7.I||{igst:0,cgst:0,sgst:0,cess:0}, t8=s.t8.K||{igst:0,cgst:0,sgst:0,cess:0}, t9=s.t9;
    return `<div class="gst-dash-head"><h2>GSTR-9 — Annual Return</h2><div class="gst-dash-meta"><span>Financial Year: <b>${esc(fy)}</b></span><span>Taxpayer: <b>${esc((gstRead('gstTaxpayer',GST_DEMO).legalName||'DEMO TAXPAYER'))}</b></span><span>Status: <b>${esc(d.status)}</b></span></div></div>
    <div class="gst-alert info"><b>Annual Return workflow.</b> This training simulator follows the current GST Portal sequence and the real FORM GSTR-9 structure — 6 Parts, 19 Tables, with the real lettered sub-rows (4A–4N, 5A–5N, 6A–6O, 7A–7J, 8A–8K) and their sub-total/cross-table formulas, matching the actual form rather than a single aggregate box per table. It is not connected to GSTN.</div>
    ${d.status==='Not Started'?`<div class="gst-section-title">Part I — Basic Details / Nil Return Question</div><table class="gst-table"><tr><th>Table 1 — Financial Year</th><td>${esc(fy)}</td></tr><tr><th>Table 2 — GSTIN</th><td>${esc(gstRead('gstTaxpayer',GST_DEMO).gstin)}</td></tr><tr><th>Table 3A — Legal Name</th><td>${esc(gstRead('gstTaxpayer',GST_DEMO).legalName)}</td></tr><tr><th>Table 3B — Trade Name</th><td>${esc(gstRead('gstTaxpayer',GST_DEMO).tradeName||'-')}</td></tr></table><div class="gst-form-grid"><div><label>Do you want to file a NIL annual return?</label><select id="g9nil" class="f-select"><option value="No">No</option><option value="Yes">Yes</option></select></div></div><div class="gst-action-row"><button class="gst-action" onclick="g9Start()">NEXT</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK</button></div>`:`
    <div class="gst-section-title">Annual Return Dashboard</div>
    <div class="gst-summary-grid"><div class="gst-summary"><div class="label">Table 4N — Taxable Value</div><div class="value">${money(t4.taxable)}</div><div class="sub">Supplies and advances on which tax is payable</div></div><div class="gst-summary"><div class="label">Table 6O — Total ITC Availed</div><div class="value">${money(t6.igst+t6.cgst+t6.sgst+t6.cess)}</div><div class="sub">After sub-totals I + N</div></div><div class="gst-summary"><div class="label">Late Fee</div><div class="value">${money(d.lateFee)}</div><div class="sub">After Compute Liabilities</div></div><div class="gst-summary"><div class="label">Additional Liability</div><div class="value">${money(d.additionalLiability)}</div><div class="sub">May require DRC-03 simulation</div></div></div>
    <div class="gst-section-title">Download / System Computed Data</div><div class="gst-action-row"><button class="gst-action secondary" onclick="g9Download('SYSTEM COMPUTED GSTR-9 SUMMARY')">DOWNLOAD GSTR-9 SYSTEM COMPUTED SUMMARY (PDF)</button><button class="gst-action secondary" onclick="g9Download('GSTR-1/1A/IFF SUMMARY')">DOWNLOAD GSTR-1/1A/IFF SUMMARY (PDF)</button><button class="gst-action secondary" onclick="g9Download('GSTR-3B SUMMARY')">DOWNLOAD GSTR-3B SUMMARY (PDF)</button><button class="gst-action secondary" onclick="g9Download('TABLE 8A DOCUMENT DETAILS')">DOWNLOAD TABLE 8A DOCUMENT DETAILS (CSV)</button></div>
    <div class="gst-section-title">Part II — Outward &amp; Inward Supplies (Tables 4–5)</div><div class="gst-tile-grid">
      ${tile('Table 4','Supplies on which tax IS payable (4A–4N)',money(t4.taxable),`<button class="gst-action" onclick="g9Tile(4)">OPEN</button>`)}
      ${tile('Table 5','Supplies on which tax is NOT payable (5A–5N)',money(s.t5.N?.taxable||0),`<button class="gst-action" onclick="g9Tile(5)">OPEN</button>`)}
    </div>
    <div class="gst-section-title">Part III — Input Tax Credit (Tables 6–8)</div><div class="gst-tile-grid">
      ${tile('Table 6','ITC availed (6A–6O)',money(t6.igst+t6.cgst+t6.sgst+t6.cess),`<button class="gst-action" onclick="g9Tile(6)">OPEN</button>`)}
      ${tile('Table 7','ITC reversed / ineligible (7A–7J)',money(t7.igst+t7.cgst+t7.sgst+t7.cess),`<button class="gst-action" onclick="g9Tile(7)">OPEN</button>`)}
      ${tile('Table 8','Other ITC information (8A–8K)',money(t8.igst+t8.cgst+t8.sgst+t8.cess),`<button class="gst-action" onclick="g9Tile(8)">OPEN</button>`)}
    </div>
    <div class="gst-section-title">Part IV — Tax Paid (Table 9)</div><div class="gst-tile-grid">
      ${tile('Table 9','Tax paid as declared in returns filed',money(t9.taxPaid),`<button class="gst-action" onclick="g9Tile(9)">OPEN</button>`)}
    </div>
    <div class="gst-section-title">Part V — Previous FY Transactions Declared in the Current FY (Tables 10–14)</div><div class="gst-tile-grid">
      ${tile('Table 10','Supplies / tax declared via Amendments (+)',money(s.t10.taxable),`<button class="gst-action" onclick="g9Tile(10)">OPEN</button>`)}
      ${tile('Table 11','Supplies / tax reduced via Amendments (-)',money(s.t11.taxable),`<button class="gst-action" onclick="g9Tile(11)">OPEN</button>`)}
      ${tile('Table 12','Reversal of ITC availed in previous FY',money(s.t12.igst+s.t12.cgst+s.t12.sgst+s.t12.cess),`<button class="gst-action" onclick="g9Tile(12)">OPEN</button>`)}
      ${tile('Table 13','ITC availed for the previous FY',money(s.t13.igst+s.t13.cgst+s.t13.sgst+s.t13.cess),`<button class="gst-action" onclick="g9Tile(13)">OPEN</button>`)}
      ${tile('Table 14','Differential tax paid (Tables 10 &amp; 11)',money(s.t14.paid),`<button class="gst-action" onclick="g9Tile(14)">OPEN</button>`)}
    </div>
    <div class="gst-section-title">Part VI — Other Information (Tables 15–19)</div><div class="gst-tile-grid">
      ${tile('Table 15','Particulars of Demands &amp; Refunds',money(s.t15.refundClaimed+s.t15.demandTaxes),`<button class="gst-action" onclick="g9Tile(15)">OPEN</button>`)}
      ${tile('Table 16','Composition / deemed supply / approval',money((s.t16.composition.taxable||0)+(s.t16.deemedSupply.taxable||0)+(s.t16.goodsSentApproval.taxable||0)),`<button class="gst-action" onclick="g9Tile(16)">OPEN</button>`)}
      ${tile('Table 17','HSN-wise summary of Outward Supplies',String(s.t17.length)+' HSN rows',`<button class="gst-action" onclick="g9HSN(17)">OPEN</button>`)}
      ${tile('Table 18','HSN-wise summary of Inward Supplies',String(s.t18.length)+' HSN rows',`<button class="gst-action" onclick="g9HSN(18)">OPEN</button>`)}
      ${tile('Table 19','Late fee payable and paid',money((s.t19.lateFeeCgstPaid||0)+(s.t19.lateFeeSgstPaid||0)),`<button class="gst-action" onclick="g9Tile(19)">OPEN</button>`)}
    </div>
    <div class="gst-section-title">Review &amp; Filing</div><div class="gst-action-row"><button class="gst-action secondary" onclick="g9Preview('PDF')">PREVIEW DRAFT GSTR-9 (PDF)</button><button class="gst-action secondary" onclick="g9Preview('EXCEL')">PREVIEW DRAFT GSTR-9 (EXCEL)</button><button class="gst-action" onclick="g9Compute()" ${filed?'disabled':''}>COMPUTE LIABILITIES</button><button class="gst-action" onclick="g9File()" ${!d.ready||filed?'disabled':''}>FILE WITH DSC / EVC</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK TO RETURNS DASHBOARD</button></div>
    <div class="gst-alert ${d.ready?'success':'warning'}">${d.ready?`<b>Ready to File.</b> Late fee computed: ${money(d.lateFee)}. Additional liability: ${money(d.additionalLiability)}.`:'Complete/review the applicable tables and click COMPUTE LIABILITIES before filing.'}</div>
    ${filed?`<div class="gst-alert success"><b>Filed successfully.</b> Simulated ARN: ${esc(d.arn)} · ${esc(d.filedAt)}<br><button class="gst-action secondary" onclick="g9Download('FILED GSTR-9 DETAILS PDF')">DOWNLOAD GSTR-9 DETAILS (PDF)</button> <button class="gst-action secondary" onclick="g9Download('DOWNLOADED GSTR-9 EXCEL')">DOWNLOAD GSTR-9 (EXCEL)</button></div>`:''}`}`;
  }
  window.g9Open=function(fy){fy=fy||'2025-26'; currentAnnualFY=fy; feature('GSTR-9 — Annual Return','Services > Returns > Annual Return',annualBody(fy));};
  window.gstOpenReturn=function(name){if(name==='GSTR-9')return g9Open(document.getElementById('gstFY')?.value||'2025-26'); if(name==='GSTR-9C')return g9cOpen(document.getElementById('gstFY')?.value||'2025-26'); return origOpenReturn(name);};
  window.g9Start=function(){const nilAns=document.getElementById('g9nil')?.value;const fy=annualFY();const d=getA(fy);d.nil=nilAns==='Yes';d.status='In Progress';if(d.nil){const fresh=annualDefault(fy);d.data=fresh.data;}saveA(d);g9Open(fy);};
  window.g9Tile=function(n){
    n=+n; const fy=annualFY(),d=getA(fy),s=d.data;
    if(n>=4&&n<=8) return g9RenderTableEditor(n,fy);
    if(n===9){
      const rows=[['igst','Integrated Tax'],['cgst','Central Tax'],['sgst','State/UT Tax'],['cess','Cess'],['interest','Interest'],['lateFee','Late Fee'],['penalty','Penalty'],['other','Other']];
      feature('Table 9 — Tax paid as declared in returns filed during the financial year','GSTR-9 > Table 9',
        `<div class="gst-alert info">Values shown are what was actually paid via your filed GSTR-3B returns for the year (Payable column is editable so you can compare against what should have been paid).</div>
        <table class="gst-table"><thead><tr><th>Description</th><th>Tax Payable</th><th>Tax Paid (thru cash + ITC)</th></tr></thead><tbody>${rows.map(([k,label])=>`<tr><td>${label}</td><td><input type="number" class="f-input g9-t9" data-k="${k}" data-c="payable" value="${s.t9rows[k].payable||0}"></td><td><input type="number" class="f-input g9-t9" data-k="${k}" data-c="paid" value="${s.t9rows[k].paid||0}"></td></tr>`).join('')}</tbody></table>
        <div class="gst-action-row"><button class="gst-action" onclick="g9SaveTable9()">SAVE</button><button class="gst-action secondary" onclick="g9Open('${esc(fy)}')">BACK TO GSTR-9 DASHBOARD</button></div>`);
      return;
    }
    if(n===10||n===11){
      const key='t'+n, label=n===10?'Table 10 — Supplies / tax declared through Amendments (+) (net of Debit Notes), for previous FY transactions declared in the current FY':'Table 11 — Supplies / tax reduced through Amendments (-) (net of Credit Notes), for previous FY transactions declared in the current FY';
      const obj=s[key];
      feature(label,'GSTR-9 > Table '+n,`<div class="gst-alert info">Reports amendments relating to the <b>previous</b> financial year that were made in returns filed between April and September of the current FY (or up to the date of filing this annual return, if earlier).</div><div class="gst-form-grid"><div><label>Taxable Value</label><input id="g9_taxable" type="number" class="f-input" value="${obj.taxable||0}"></div><div><label>Integrated Tax</label><input id="g9_igst" type="number" class="f-input" value="${obj.igst||0}"></div><div><label>Central Tax</label><input id="g9_cgst" type="number" class="f-input" value="${obj.cgst||0}"></div><div><label>State/UT Tax</label><input id="g9_sgst" type="number" class="f-input" value="${obj.sgst||0}"></div><div><label>Cess</label><input id="g9_cess" type="number" class="f-input" value="${obj.cess||0}"></div></div><div class="gst-action-row"><button class="gst-action" onclick="g9SaveSimple('${key}')">SAVE</button><button class="gst-action secondary" onclick="g9Open('${esc(fy)}')">BACK TO GSTR-9 DASHBOARD</button></div>`);
      return;
    }
    if(n===12||n===13){
      const key='t'+n, label=n===12?'Table 12 — Reversal of ITC availed during the previous financial year':'Table 13 — ITC availed for the previous financial year';
      const obj=s[key];
      feature(label,'GSTR-9 > Table '+n,`<div class="gst-form-grid"><div><label>Integrated Tax</label><input id="g9_igst" type="number" class="f-input" value="${obj.igst||0}"></div><div><label>Central Tax</label><input id="g9_cgst" type="number" class="f-input" value="${obj.cgst||0}"></div><div><label>State/UT Tax</label><input id="g9_sgst" type="number" class="f-input" value="${obj.sgst||0}"></div><div><label>Cess</label><input id="g9_cess" type="number" class="f-input" value="${obj.cess||0}"></div></div><div class="gst-action-row"><button class="gst-action" onclick="g9SaveSimpleITC('${key}')">SAVE</button><button class="gst-action secondary" onclick="g9Open('${esc(fy)}')">BACK TO GSTR-9 DASHBOARD</button></div>`);
      return;
    }
    if(n===14){
      const obj=s.t14;
      feature('Table 14 — Differential tax paid on account of declaration in Table 10 & 11','GSTR-9 > Table 14',`<div class="gst-form-grid"><div><label>Payable</label><input id="g9_payable" type="number" class="f-input" value="${obj.payable||0}"></div><div><label>Paid</label><input id="g9_paid" type="number" class="f-input" value="${obj.paid||0}"></div></div><div class="gst-action-row"><button class="gst-action" onclick="g9SaveTable14()">SAVE</button><button class="gst-action secondary" onclick="g9Open('${esc(fy)}')">BACK TO GSTR-9 DASHBOARD</button></div>`);
      return;
    }
    if(n===15){
      const o=s.t15;
      feature('Table 15 — Particulars of Demands and Refunds','GSTR-9 > Table 15',`<div class="gst-form-grid">
        <div><label>15A — Total Refund claimed</label><input id="g9_refundClaimed" type="number" class="f-input" value="${o.refundClaimed||0}"></div>
        <div><label>15B — Total Refund sanctioned</label><input id="g9_refundSanctioned" type="number" class="f-input" value="${o.refundSanctioned||0}"></div>
        <div><label>15C — Total Refund Rejected</label><input id="g9_refundRejected" type="number" class="f-input" value="${o.refundRejected||0}"></div>
        <div><label>15D — Total Refund Pending</label><input id="g9_refundPending" type="number" class="f-input" value="${o.refundPending||0}"></div>
        <div><label>15E — Total demand of taxes</label><input id="g9_demandTaxes" type="number" class="f-input" value="${o.demandTaxes||0}"></div>
        <div><label>15F — Total taxes paid in respect of E above</label><input id="g9_demandPaid" type="number" class="f-input" value="${o.demandPaid||0}"></div>
        <div><label>15G — Total demands pending out of E above</label><input id="g9_demandPending" type="number" class="f-input" value="${o.demandPending||0}"></div>
        </div><div class="gst-action-row"><button class="gst-action" onclick="g9SaveTable15()">SAVE</button><button class="gst-action secondary" onclick="g9Open('${esc(fy)}')">BACK TO GSTR-9 DASHBOARD</button></div>`);
      return;
    }
    if(n===16){
      const o=s.t16;
      const block=(key,label)=>`<h4 class="pb-subhead full">${label}</h4><div><label>Taxable Value</label><input id="g9_16_${key}_taxable" type="number" class="f-input" value="${o[key].taxable||0}"></div><div><label>Integrated Tax</label><input id="g9_16_${key}_igst" type="number" class="f-input" value="${o[key].igst||0}"></div><div><label>Central Tax</label><input id="g9_16_${key}_cgst" type="number" class="f-input" value="${o[key].cgst||0}"></div><div><label>State/UT Tax</label><input id="g9_16_${key}_sgst" type="number" class="f-input" value="${o[key].sgst||0}"></div><div><label>Cess</label><input id="g9_16_${key}_cess" type="number" class="f-input" value="${o[key].cess||0}"></div>`;
      feature('Table 16 — Supplies received from composition taxpayers, deemed supply and goods sent on approval','GSTR-9 > Table 16',`<div class="gst-form-grid">
        ${block('composition','16A — Supplies received from Composition taxpayers')}
        ${block('deemedSupply','16B — Deemed supply under Section 143')}
        ${block('goodsSentApproval','16C — Goods sent on approval basis but not returned')}
        </div><div class="gst-action-row"><button class="gst-action" onclick="g9SaveTable16()">SAVE</button><button class="gst-action secondary" onclick="g9Open('${esc(fy)}')">BACK TO GSTR-9 DASHBOARD</button></div>`);
      return;
    }
    if(n===19){
      const o=s.t19;
      feature('Table 19 — Late fee payable and paid','GSTR-9 > Table 19',`<div class="gst-form-grid">
        <div><label>Central Tax — Payable</label><input id="g9_lateFeeCgstPayable" type="number" class="f-input" value="${o.lateFeeCgstPayable||0}"></div>
        <div><label>Central Tax — Paid</label><input id="g9_lateFeeCgstPaid" type="number" class="f-input" value="${o.lateFeeCgstPaid||0}"></div>
        <div><label>State/UT Tax — Payable</label><input id="g9_lateFeeSgstPayable" type="number" class="f-input" value="${o.lateFeeSgstPayable||0}"></div>
        <div><label>State/UT Tax — Paid</label><input id="g9_lateFeeSgstPaid" type="number" class="f-input" value="${o.lateFeeSgstPaid||0}"></div>
        </div><div class="gst-action-row"><button class="gst-action" onclick="g9SaveTable19()">SAVE</button><button class="gst-action secondary" onclick="g9Open('${esc(fy)}')">BACK TO GSTR-9 DASHBOARD</button></div>`);
      return;
    }
  };
  window.g9SaveTable9=function(){const fy=annualFY(),d=getA(fy);document.querySelectorAll('.g9-t9').forEach(el=>{const k=el.dataset.k,c=el.dataset.c;d.data.t9rows[k][c]=+el.value||0;});d.data.t9.taxPayable=Object.values(d.data.t9rows).reduce((s,r)=>s+(+r.payable||0),0);d.data.t9.taxPaid=Object.values(d.data.t9rows).reduce((s,r)=>s+(+r.paid||0),0);d.status='In Progress';saveA(d);notify('Table 9 saved.');g9Open(fy)};
  window.g9SaveSimple=function(key){const fy=annualFY(),d=getA(fy);d.data[key]={taxable:num('g9_taxable'),igst:num('g9_igst'),cgst:num('g9_cgst'),sgst:num('g9_sgst'),cess:num('g9_cess')};d.status='In Progress';saveA(d);notify('Saved.');g9Open(fy)};
  window.g9SaveSimpleITC=function(key){const fy=annualFY(),d=getA(fy);d.data[key]={igst:num('g9_igst'),cgst:num('g9_cgst'),sgst:num('g9_sgst'),cess:num('g9_cess')};d.status='In Progress';saveA(d);notify('Saved.');g9Open(fy)};
  window.g9SaveTable14=function(){const fy=annualFY(),d=getA(fy);d.data.t14={payable:num('g9_payable'),paid:num('g9_paid')};d.status='In Progress';saveA(d);notify('Table 14 saved.');g9Open(fy)};
  window.g9SaveTable15=function(){const fy=annualFY(),d=getA(fy);d.data.t15={refundClaimed:num('g9_refundClaimed'),refundSanctioned:num('g9_refundSanctioned'),refundRejected:num('g9_refundRejected'),refundPending:num('g9_refundPending'),demandTaxes:num('g9_demandTaxes'),demandPaid:num('g9_demandPaid'),demandPending:num('g9_demandPending')};d.status='In Progress';saveA(d);notify('Table 15 saved.');g9Open(fy)};
  window.g9SaveTable16=function(){const fy=annualFY(),d=getA(fy);['composition','deemedSupply','goodsSentApproval'].forEach(key=>{d.data.t16[key]={taxable:num('g9_16_'+key+'_taxable'),igst:num('g9_16_'+key+'_igst'),cgst:num('g9_16_'+key+'_cgst'),sgst:num('g9_16_'+key+'_sgst'),cess:num('g9_16_'+key+'_cess')};});d.status='In Progress';saveA(d);notify('Table 16 saved.');g9Open(fy)};
  window.g9SaveTable19=function(){const fy=annualFY(),d=getA(fy);d.data.t19={lateFeeCgstPayable:num('g9_lateFeeCgstPayable'),lateFeeCgstPaid:num('g9_lateFeeCgstPaid'),lateFeeSgstPayable:num('g9_lateFeeSgstPayable'),lateFeeSgstPaid:num('g9_lateFeeSgstPaid')};d.status='In Progress';saveA(d);notify('Table 19 saved.');g9Open(fy)};
  window.g9HSN=function(n){const fy=annualFY(),d=getA(fy),list=d.data['t'+n];feature(`GSTR-9 Table ${n} — HSN-wise Summary`,`GSTR-9 > Table ${n}`,`<div class="gst-alert info">For FY 2024-25 onwards the HSN summary workflow requires HSN/SAC, UQC, quantity, taxable value, rate and tax values. Duplicate entries are not permitted in the simulator.</div><div class="gst-form-grid"><div><label>HSN / SAC *</label><input id="g9hsn" class="f-input"></div><div><label>UQC *</label><select id="g9uqc" class="f-select"><option>PCS</option><option>KGS</option><option>NOS</option><option>OTH-Others</option></select></div><div><label>Total Quantity</label><input id="g9qty" type="number" class="f-input" value="0"></div><div><label>Taxable Value *</label><input id="g9hTax" type="number" class="f-input"></div><div><label>Rate % *</label><select id="g9hRate" class="f-select"><option>5</option><option selected>18</option><option>40</option></select></div><div><label>IGST</label><input id="g9hI" type="number" class="f-input" value="0"></div><div><label>CGST</label><input id="g9hC" type="number" class="f-input" value="0"></div><div><label>SGST</label><input id="g9hS" type="number" class="f-input" value="0"></div><div><label>Cess</label><input id="g9hCe" type="number" class="f-input" value="0"></div></div><div class="gst-action-row"><button class="gst-action" onclick="g9AddHSN(${n})">ADD</button><button class="gst-action secondary" onclick="g9Open('${esc(fy)}')">BACK TO GSTR-9 DASHBOARD</button></div><table class="gst-table"><thead><tr><th>HSN/SAC</th><th>UQC</th><th>Qty</th><th>Taxable</th><th>Rate</th><th>IGST</th><th>CGST</th><th>SGST</th><th>Cess</th><th>Action</th></tr></thead><tbody>${list.map((x,i)=>`<tr><td>${esc(x.hsn)}</td><td>${esc(x.uqc)}</td><td>${x.qty}</td><td>${money(x.taxable)}</td><td>${x.rate}%</td><td>${money(x.igst)}</td><td>${money(x.cgst)}</td><td>${money(x.sgst)}</td><td>${money(x.cess)}</td><td><button class="gst-action secondary" onclick="g9DelHSN(${n},${i})">DELETE</button></td></tr>`).join('')||'<tr><td colspan="10">No HSN details added.</td></tr>'}</tbody></table>`);};
  window.g9AddHSN=function(n){const fy=annualFY(),d=getA(fy),list=d.data['t'+n],v={hsn:document.getElementById('g9hsn')?.value.trim(),uqc:document.getElementById('g9uqc')?.value,qty:num('g9qty'),taxable:num('g9hTax'),rate:num('g9hRate'),igst:num('g9hI'),cgst:num('g9hC'),sgst:num('g9hS'),cess:num('g9hCe')}; if(!v.hsn||v.taxable<0){notify('Enter mandatory HSN/SAC and taxable value.');return} if(list.some(x=>x.hsn===v.hsn&&x.rate===v.rate&&x.uqc===v.uqc)){notify('Duplicate HSN entry detected.');return} const totalTax=v.igst+v.cgst+v.sgst+v.cess; if(Math.abs(totalTax-(v.taxable*v.rate/100))>10){notify('Reported tax exceeds the ₹10 tolerance used by the simulator.');return} list.push(v);saveA(d);g9HSN(n);};
  window.g9DelHSN=function(n,i){const d=getA(annualFY());d.data['t'+n].splice(i,1);saveA(d);g9HSN(n)};
  window.g9Compute=function(){const fy=annualFY(),d=getA(fy);g9Recompute(fy);const d2=getA(fy);if(d2.nil){d2.lateFee=0;d2.additionalLiability=0;}else{d2.lateFee=(+d2.data.t19.lateFeeCgstPayable||0)+(+d2.data.t19.lateFeeSgstPayable||0);d2.additionalLiability=Math.max(0,(d2.data.t9.taxPayable||0)-(d2.data.t9.taxPaid||0));} if(!d2.nil && d2.data.t17.length===0){notify('Complete Table 17 HSN-wise summary of Outward Supplies before COMPUTE LIABILITIES.');return} d2.computed=true;d2.ready=true;d2.status='Ready to File';saveA(d2);g9Open(fy);};
  window.g9Preview=function(kind){const fy=annualFY(),d=getA(fy),t=d.data;const t4N=t.t4.N||{taxable:0},t6O=t.t6.O||{igst:0,cgst:0,sgst:0,cess:0},t7I=t.t7.I||{igst:0,cgst:0,sgst:0,cess:0};const txt=`GST PORTAL TRAINING SIMULATOR\nGSTR-9 DRAFT PREVIEW\nFinancial Year: ${fy}\nStatus: ${d.status}\n\nTable 4N (Supplies/advances on which tax is payable) Taxable: ${t4N.taxable}\nTable 6O (Total ITC availed): ${t6O.igst+t6O.cgst+t6O.sgst+t6O.cess}\nTable 7I (Total ITC reversed): ${t7I.igst+t7I.cgst+t7I.sgst+t7I.cess}\nTable 9 Tax Paid: ${t.t9.taxPaid}\nTable 17 HSN rows: ${t.t17.length}\nTable 18 HSN rows: ${t.t18.length}\nLate Fee: ${d.lateFee}\nAdditional Liability: ${d.additionalLiability}\n\nSIMULATED TRAINING DOCUMENT — NOT A GOVERNMENT DOCUMENT`; const blob=new Blob([txt],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`GSTR9_DRAFT_${fy}_${kind}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);};
  window.g9Download=function(label){const fy=annualFY();const blob=new Blob([`GST PORTAL TRAINING SIMULATOR\n${label}\nFinancial Year: ${fy}\nSIMULATED TRAINING DOCUMENT — NOT A GOVERNMENT DOCUMENT`],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${label.replace(/[^A-Za-z0-9]+/g,'_')}_${fy}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
  window.g9File=function(){const fy=annualFY(),d=getA(fy);if(!d.ready||d.status==='Filed'){notify('GSTR-9 is not ready for filing or is already filed.');return}const arn='SIM-GSTR9-'+new Date().getFullYear()+'-'+Math.random().toString(36).slice(2,10).toUpperCase();d.status='Filed';d.arn=arn;d.filedAt=new Date().toLocaleString();saveA(d);window.gstAddFiledReturn&&window.gstAddFiledReturn({reference:arn,filedAt:new Date().toISOString(),status:'Filed',fy,period:'Annual '+fy,filingMode:'Simulated DSC'},'GSTR-9');notify('GSTR-9 filed successfully. Simulated ARN generated.');g9Open(fy);};

  function g9cOpen(fy){const d=getC(fy);feature('GSTR-9C — Reconciliation Statement','Services > Returns > Annual Return > GSTR-9C',g9cBody(fy,d));}
  function g9cBody(fy,d){const b=d.books,g=d.gst,r=d.differences||{};return `<div class="gst-dash-head"><h2>GSTR-9C — Reconciliation Statement</h2><div class="gst-dash-meta"><span>Financial Year: <b>${esc(fy)}</b></span><span>Status: <b>${esc(d.status)}</b></span><span>Certification: <b>${esc(d.certification)}</b></span></div></div><div class="gst-alert info">Training reconciliation workspace. Enter book/audited figures and compare them with the simulated GST data accumulated from GSTR-1, GSTR-3B, GSTR-2B and ledgers. This offline simulator does not issue a real auditor certificate.</div><div class="gst-section-title">Reconciliation Inputs</div><table class="gst-table"><thead><tr><th>Particular</th><th>Books / Audited Figures</th><th>GST Data</th><th>Difference</th></tr></thead><tbody>${[['Turnover','turnover'],['Taxable Turnover','taxable'],['IGST','igst'],['CGST','cgst'],['SGST/UTGST','sgst'],['Cess','cess'],['Tax Paid','taxPaid'],['ITC','itc']].map(([l,k])=>`<tr><td>${l}</td><td><input id="c9_${k}" type="number" class="f-input" value="${b[k]||0}"></td><td>${money(g[k]||0)}</td><td>${money((b[k]||0)-(g[k]||0))}</td></tr>`).join('')}</tbody></table><div class="gst-action-row"><button class="gst-action" onclick="g9cCompute('${esc(fy)}')">RECONCILE / SAVE</button><button class="gst-action secondary" onclick="g9cPreview('${esc(fy)}')">PREVIEW</button><button class="gst-action" onclick="g9cCertify('${esc(fy)}')">SIMULATE CERTIFICATION</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK</button></div><div class="gst-section-title">Reconciliation Result</div><div class="gst-alert ${Object.values(r).every(x=>Math.abs(x)<0.01)?'success':'warning'}">${Object.values(r).every(x=>Math.abs(x)<0.01)?'<b>No differences identified in entered fields.</b>':'Differences require reconciliation and explanation before completion.'}</div><div class="gst-form-grid"><div style="grid-column:1/-1"><label>Reasons / reconciliation notes</label><textarea id="c9_notes" class="f-input" style="min-height:100px">${esc(d.notes||'')}</textarea></div></div>`}
  window.g9cCompute=function(fy){const d=getC(fy);const src=dataFromReturns(fy);d.gst={turnover:src.taxable,taxable:src.taxable,igst:src.igst,cgst:src.cgst,sgst:src.sgst,cess:src.cess,taxPaid:0,itc:src.itc};for(const k of Object.keys(d.books))d.books[k]=num('c9_'+k);d.differences={};for(const k of Object.keys(d.books))d.differences[k]=(d.books[k]||0)-(d.gst[k]||0);d.notes=document.getElementById('c9_notes')?.value||'';d.status='Reconciled';saveC(d);g9cOpen(fy)};
  window.g9cPreview=function(fy){const d=getC(fy);const txt=`GST PORTAL TRAINING SIMULATOR\nGSTR-9C RECONCILIATION PREVIEW\nFY: ${fy}\nStatus: ${d.status}\nCertification: ${d.certification}\n\nDifferences:\n${Object.entries(d.differences||{}).map(([k,v])=>k+': '+v).join('\n')}\n\nSIMULATED TRAINING DOCUMENT — NOT A GOVERNMENT DOCUMENT`;const blob=new Blob([txt],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`GSTR9C_${fy}_PREVIEW.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
  window.g9cCertify=function(fy){const d=getC(fy);if(d.status!=='Reconciled'){notify('Reconcile and save the figures before certification.');return}d.certification='Simulated Certification Complete';d.status='Ready';d.arn='SIM-GSTR9C-'+new Date().getFullYear()+'-'+Math.random().toString(36).slice(2,10).toUpperCase();d.filedAt=new Date().toLocaleString();saveC(d);window.gstAddFiledReturn&&window.gstAddFiledReturn({reference:d.arn,filedAt:new Date().toISOString(),status:'Filed',fy,period:'Annual '+fy,filingMode:'Simulated DSC'},'GSTR-9C');notify('GSTR-9C simulated certification completed.');g9cOpen(fy)};

  /* ================= GSTR-4 / GSTR-5 / GSTR-5A — built new, not present before this pass ================= */
  function g4Key(fy){return 'gstGstr4_'+fy}
  function g4Data(fy){return gstRead(g4Key(fy),{fy,status:'Draft',inwardRegistered:0,inwardUnregistered:0,inwardImport:0,inwardRcm:0,outwardTaxRate:[{rate:1,taxable:0,tax:0,label:'Traders / Manufacturers (1%)'},{rate:5,taxable:0,tax:0,label:'Restaurant Service, not serving alcohol (5%)'},{rate:6,taxable:0,tax:0,label:'Service Providers under Section 10(2A) (6%)'}],tdsTcs:0,interest:0,lateFee:0,arn:null,filedAt:null})}
  function g4Save(fy,d){gstWrite(g4Key(fy),d)}
  function g4Open(fy){
    if(!gstRequireLogin('GSTR-4'))return;
    fy=fy||document.getElementById('gstFY')?.value||gstReturnContext().fy;
    const d=g4Data(fy);
    const cmp08Total=(()=>{let t=0;for(let q=1;q<=4;q++){const c=gstRead('gstCMP08_'+fy+'_Q'+q,null);if(c&&c.status==='Filed')t+=(+c.tax||0)+(+c.interest||0);}return t;})();
    feature('GSTR-4 — Annual Return (Composition Taxpayers)','Services > Returns > Annual Return > GSTR-4',`
      <div class="gst-dash-head"><h2>GSTR-4 — Annual Return, FY ${esc(fy)}</h2><div class="gst-dash-meta"><span>Status: <b>${esc(d.status)}</b></span><span>Due Date: <b>30th June following the FY</b></span>${d.arn?`<span>ARN: <b>${esc(d.arn)}</b></span>`:''}</div></div>
      <div class="gst-alert info">For taxpayers who opted for the Composition Scheme. Aggregates the four quarterly CMP-08 self-assessed payments for the year and reports annual inward/outward summary figures.</div>
      <div class="gst-section-title">Table 4 — Inward Supplies (including RCM)</div>
      <table class="gst-table"><tr><th>From Registered Persons (other than RCM)</th><td><input id="g4_inR" type="number" class="f-input" value="${d.inwardRegistered}"></td></tr>
      <tr><th>From Unregistered Persons</th><td><input id="g4_inU" type="number" class="f-input" value="${d.inwardUnregistered}"></td></tr>
      <tr><th>Import of Services</th><td><input id="g4_inI" type="number" class="f-input" value="${d.inwardImport}"></td></tr>
      <tr><th>Inward Supplies Attracting Reverse Charge</th><td><input id="g4_inRcm" type="number" class="f-input" value="${d.inwardRcm}"></td></tr></table>
      <div class="gst-section-title">Table 6 — Tax Rate wise details of Outward Supplies</div>
      <table class="gst-table"><thead><tr><th>Composition Category / Rate</th><th>Taxable Value</th><th>Tax Amount</th></tr></thead><tbody>${d.outwardTaxRate.map((r,i)=>`<tr><td>${esc(r.label||r.rate+'%')}</td><td><input id="g4_ot_${i}" type="number" class="f-input" value="${r.taxable}"></td><td>${gstMoney(r.taxable*r.rate/100)}</td></tr>`).join('')}</tbody></table>
      <div class="gst-section-title">Table 7 &amp; 8 — TDS/TCS Credit, Interest &amp; Late Fee</div>
      <table class="gst-table"><tr><th>TDS/TCS Credit Received</th><td><input id="g4_tds" type="number" class="f-input" value="${d.tdsTcs}"></td></tr>
      <tr><th>CMP-08 payments filed this year (auto)</th><td>${gstMoney(cmp08Total)}</td></tr>
      <tr><th>Interest Payable</th><td><input id="g4_int" type="number" class="f-input" value="${d.interest}"></td></tr>
      <tr><th>Late Fee Payable</th><td><input id="g4_lf" type="number" class="f-input" value="${d.lateFee}"></td></tr></table>
      <div class="gst-action-row"><button class="gst-action" onclick="g4SaveDraft('${esc(fy)}')">SAVE</button><button class="gst-action secondary" onclick="g4Validate('${esc(fy)}')">VALIDATE</button><button class="gst-action" ${d.status==='Filed'?'disabled':''} onclick="g4File('${esc(fy)}')">FILE GSTR-4</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK</button></div>
      ${d.status==='Filed'?`<div class="gst-alert success">Filed on ${esc(d.filedAt)}. ARN: <b>${esc(d.arn)}</b></div>`:''}
      <div class="gst-note">Training simulator: figures are self-entered for practice; nothing here is transmitted to GSTN.</div>`);
  }
  function g4CollectInputs(fy){const d=g4Data(fy);const n=id=>+(document.getElementById(id)?.value||0);d.inwardRegistered=n('g4_inR');d.inwardUnregistered=n('g4_inU');d.inwardImport=n('g4_inI');d.inwardRcm=n('g4_inRcm');d.outwardTaxRate=d.outwardTaxRate.map((r,i)=>({...r,taxable:n('g4_ot_'+i),tax:n('g4_ot_'+i)*r.rate/100}));d.tdsTcs=n('g4_tds');d.interest=n('g4_int');d.lateFee=n('g4_lf');return d}
  window.g4SaveDraft=function(fy){const d=g4CollectInputs(fy);g4Save(fy,d);notify('GSTR-4 draft saved.');g4Open(fy)};
  window.g4Validate=function(fy){const d=g4CollectInputs(fy);const totalOutwardTax=d.outwardTaxRate.reduce((s,r)=>s+r.tax,0);if(totalOutwardTax<=0 && d.inwardRcm<=0){notify('Enter at least some outward tax or reverse-charge inward supply figures before validating.');return false}d.status='Validated';g4Save(fy,d);notify('GSTR-4 validated. You can now file.');g4Open(fy);return true};
  window.g4File=function(fy){const d=g4CollectInputs(fy);if(d.status!=='Validated'){notify('Validate GSTR-4 before filing.');return}d.status='Filed';d.arn='SIM-GSTR4-'+fy.replace('-','')+'-'+Math.random().toString(36).slice(2,10).toUpperCase();d.filedAt=new Date().toLocaleString();g4Save(fy,d);window.gstAddFiledReturn&&window.gstAddFiledReturn({reference:d.arn,filedAt:new Date().toISOString(),status:'Filed',fy,period:'Annual '+fy,filingMode:'Simulated EVC'},'GSTR-4');notify('GSTR-4 filed successfully.');g4Open(fy)};

  function g5Key(){const c=gstReturnContext();return 'gstGstr5_'+c.fy+'_'+c.period.replace(/[^A-Za-z0-9]/g,'_')}
  function g5Data(){return gstRead(g5Key(),{status:'Draft',outward:[],imports:0,creditNotes:0,debitNotes:0,interest:0,arn:null,filedAt:null})}
  function g5Save(d){gstWrite(g5Key(),d)}
  function g5Open(){
    if(!gstRequireLogin('GSTR-5'))return;
    const ctx=gstReturnContext(),d=g5Data();
    const taxTotal=d.outward.reduce((s,r)=>s+(+r.igst||0)+(+r.cgst||0)+(+r.sgst||0),0);
    feature('GSTR-5 — Return for Non-Resident Taxable Person','Services > Returns > GSTR-5',`
      <div class="gst-dash-head"><h2>GSTR-5, ${esc(ctx.period)}</h2><div class="gst-dash-meta"><span>Status: <b>${esc(d.status)}</b></span><span>Due: 13th of succeeding month</span>${d.arn?`<span>ARN: <b>${esc(d.arn)}</b></span>`:''}</div></div>
      <div class="gst-alert info">For a non-resident taxable person doing business in India for a limited period. Reports outward supplies made, imports of goods, and amount of tax payable — no ITC of Indian domestic purchases is claimed here.</div>
      <div class="gst-section-title">Table 6 — Outward Supplies</div>
      <table class="gst-table"><thead><tr><th>Recipient GSTIN / Unregistered</th><th>Taxable Value</th><th>IGST</th><th>CGST</th><th>SGST</th><th></th></tr></thead><tbody>${d.outward.map((r,i)=>`<tr><td>${esc(r.party)}</td><td>${gstMoney(r.taxable)}</td><td>${gstMoney(r.igst)}</td><td>${gstMoney(r.cgst)}</td><td>${gstMoney(r.sgst)}</td><td><a href="#" onclick="event.preventDefault();g5RemoveRow(${i})">Remove</a></td></tr>`).join('')||'<tr><td colspan="6">No outward supply records added yet.</td></tr>'}</tbody></table>
      <div class="gst-form-grid"><div><label>Recipient GSTIN / "Unregistered"</label><input id="g5_party" class="f-input" placeholder="Enter GSTIN or Unregistered"></div><div><label>Taxable Value</label><input id="g5_taxable" type="number" class="f-input"></div><div><label>IGST</label><input id="g5_igst" type="number" class="f-input"></div><div><label>CGST</label><input id="g5_cgst" type="number" class="f-input"></div><div><label>SGST</label><input id="g5_sgst" type="number" class="f-input"></div><div style="align-self:end"><button class="gst-action" onclick="g5AddRow()">+ ADD ROW</button></div></div>
      <div class="gst-section-title">Table 8 — Imports of Goods, Table 9/10 — Credit/Debit Notes, Interest</div>
      <table class="gst-table"><tr><th>Import of Goods (Taxable Value)</th><td><input id="g5_imports" type="number" class="f-input" value="${d.imports}"></td></tr>
      <tr><th>Credit Notes Issued</th><td><input id="g5_cn" type="number" class="f-input" value="${d.creditNotes}"></td></tr>
      <tr><th>Debit Notes Issued</th><td><input id="g5_dn" type="number" class="f-input" value="${d.debitNotes}"></td></tr>
      <tr><th>Interest Payable</th><td><input id="g5_int" type="number" class="f-input" value="${d.interest}"></td></tr>
      <tr><th>Total Tax Payable (outward supplies)</th><td>${gstMoney(taxTotal)}</td></tr></table>
      <div class="gst-action-row"><button class="gst-action" onclick="g5SaveDraft()">SAVE</button><button class="gst-action secondary" onclick="g5Validate()">VALIDATE</button><button class="gst-action" ${d.status==='Filed'?'disabled':''} onclick="g5File()">FILE GSTR-5</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK</button></div>
      ${d.status==='Filed'?`<div class="gst-alert success">Filed on ${esc(d.filedAt)}. ARN: <b>${esc(d.arn)}</b></div>`:''}
      <div class="gst-note">Training simulator only.</div>`);
  }
  window.g5AddRow=function(){const d=g5Data();const party=(document.getElementById('g5_party')?.value||'').trim();if(!party){notify('Enter a recipient GSTIN or "Unregistered" first.');return}d.outward.push({party,taxable:+document.getElementById('g5_taxable').value||0,igst:+document.getElementById('g5_igst').value||0,cgst:+document.getElementById('g5_cgst').value||0,sgst:+document.getElementById('g5_sgst').value||0});g5Save(d);g5Open()};
  window.g5RemoveRow=function(i){const d=g5Data();d.outward.splice(i,1);g5Save(d);g5Open()};
  function g5CollectInputs(){const d=g5Data();d.imports=+document.getElementById('g5_imports')?.value||0;d.creditNotes=+document.getElementById('g5_cn')?.value||0;d.debitNotes=+document.getElementById('g5_dn')?.value||0;d.interest=+document.getElementById('g5_int')?.value||0;return d}
  window.g5SaveDraft=function(){const d=g5CollectInputs();g5Save(d);notify('GSTR-5 draft saved.');g5Open()};
  window.g5Validate=function(){const d=g5CollectInputs();if(!d.outward.length && !d.imports){notify('Add at least one outward supply row or an import figure before validating.');return false}d.status='Validated';g5Save(d);notify('GSTR-5 validated.');g5Open();return true};
  window.g5File=function(){const d=g5CollectInputs();if(d.status!=='Validated'){notify('Validate GSTR-5 before filing.');return}d.status='Filed';d.arn='SIM-GSTR5-'+gstReturnContext().period.replace(/\s+/g,'')+'-'+Math.random().toString(36).slice(2,10).toUpperCase();d.filedAt=new Date().toLocaleString();g5Save(d);window.gstAddFiledReturn&&window.gstAddFiledReturn({reference:d.arn,filedAt:new Date().toISOString(),status:'Filed',filingMode:'Simulated EVC'},'GSTR-5');notify('GSTR-5 filed successfully.');g5Open()};

  function g5aKey(){const c=gstReturnContext();return 'gstGstr5A_'+c.fy+'_'+c.period.replace(/[^A-Za-z0-9]/g,'_')}
  function g5aData(){return gstRead(g5aKey(),{status:'Draft',rows:[],arn:null,filedAt:null})}
  function g5aSave(d){gstWrite(g5aKey(),d)}
  const IN_STATES=['Kerala','Tamil Nadu','Karnataka','Maharashtra','Delhi','Uttar Pradesh','Gujarat','West Bengal','Telangana','Rajasthan'];
  function g5aOpen(){
    if(!gstRequireLogin('GSTR-5A'))return;
    const ctx=gstReturnContext(),d=g5aData();
    const total=d.rows.reduce((s,r)=>s+(+r.igst||0),0);
    feature('GSTR-5A — Return for OIDAR Service Providers','Services > Returns > GSTR-5A',`
      <div class="gst-dash-head"><h2>GSTR-5A, ${esc(ctx.period)}</h2><div class="gst-dash-meta"><span>Status: <b>${esc(d.status)}</b></span><span>Due: 20th of succeeding month</span>${d.arn?`<span>ARN: <b>${esc(d.arn)}</b></span>`:''}</div></div>
      <div class="gst-alert info">For a person located outside India supplying Online Information Database Access and Retrieval (OIDAR) services to unregistered/non-taxable persons in India. Only IGST applies — no place-of-supply choice, no ITC claimed.</div>
      <div class="gst-section-title">Table 5 — Taxable Outward Supplies, State-wise</div>
      <table class="gst-table"><thead><tr><th>State (Place of Supply)</th><th>Taxable Value</th><th>Rate (%)</th><th>IGST</th><th></th></tr></thead><tbody>${d.rows.map((r,i)=>`<tr><td>${esc(r.state)}</td><td>${gstMoney(r.taxable)}</td><td>${r.rate}%</td><td>${gstMoney(r.igst)}</td><td><a href="#" onclick="event.preventDefault();g5aRemoveRow(${i})">Remove</a></td></tr>`).join('')||'<tr><td colspan="5">No rows added yet.</td></tr>'}</tbody></table>
      <div class="gst-form-grid"><div><label>State (Place of Supply)</label><select id="g5a_state" class="f-input"><option value="">Select</option>${IN_STATES.map(s=>`<option>${s}</option>`).join('')}</select></div><div><label>Taxable Value</label><input id="g5a_taxable" type="number" class="f-input"></div><div><label>Rate (%)</label><select id="g5a_rate" class="f-input"><option value="18">18%</option><option value="40">40%</option><option value="5">5%</option></select></div><div style="align-self:end"><button class="gst-action" onclick="g5aAddRow()">+ ADD ROW</button></div></div>
      <div class="gst-section-title">Table 6 — Tax, Interest and Late Fee Payable</div>
      <table class="gst-table"><tr><th>Total IGST Payable</th><td>${gstMoney(total)}</td></tr></table>
      <div class="gst-action-row"><button class="gst-action" onclick="g5aSaveDraft()">SAVE</button><button class="gst-action secondary" onclick="g5aValidate()">VALIDATE</button><button class="gst-action" ${d.status==='Filed'?'disabled':''} onclick="g5aFile()">FILE GSTR-5A</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK</button></div>
      ${d.status==='Filed'?`<div class="gst-alert success">Filed on ${esc(d.filedAt)}. ARN: <b>${esc(d.arn)}</b></div>`:''}
      <div class="gst-note">Training simulator only.</div>`);
  }
  window.g5aAddRow=function(){const d=g5aData();const state=document.getElementById('g5a_state')?.value;const taxable=+document.getElementById('g5a_taxable')?.value||0;const rate=+document.getElementById('g5a_rate')?.value||18;if(!state||!taxable){notify('Select a state and enter a taxable value first.');return}d.rows.push({state,taxable,rate,igst:taxable*rate/100});g5aSave(d);g5aOpen()};
  window.g5aRemoveRow=function(i){const d=g5aData();d.rows.splice(i,1);g5aSave(d);g5aOpen()};
  window.g5aSaveDraft=function(){const d=g5aData();g5aSave(d);notify('GSTR-5A draft saved.');g5aOpen()};
  window.g5aValidate=function(){const d=g5aData();if(!d.rows.length){notify('Add at least one state-wise supply row before validating.');return false}d.status='Validated';g5aSave(d);notify('GSTR-5A validated.');g5aOpen();return true};
  window.g5aFile=function(){const d=g5aData();if(d.status!=='Validated'){notify('Validate GSTR-5A before filing.');return}d.status='Filed';d.arn='SIM-GSTR5A-'+gstReturnContext().period.replace(/\s+/g,'')+'-'+Math.random().toString(36).slice(2,10).toUpperCase();d.filedAt=new Date().toLocaleString();g5aSave(d);window.gstAddFiledReturn&&window.gstAddFiledReturn({reference:d.arn,filedAt:new Date().toISOString(),status:'Filed',filingMode:'Simulated EVC'},'GSTR-5A');notify('GSTR-5A filed successfully.');g5aOpen()};

  /* ================= GSTR-6 (ISD) / GSTR-7 (TDS) / GSTR-8 (TCS/e-comm) — built new ================= */
  function g6Key(){const c=gstReturnContext();return 'gstGstr6_'+c.fy+'_'+c.period.replace(/[^A-Za-z0-9]/g,'_')}
  function g6Data(){return gstRead(g6Key(),{status:'Draft',received:{igst:0,cgst:0,sgst:0,cess:0},distributions:[],arn:null,filedAt:null})}
  function g6Save(d){gstWrite(g6Key(),d)}
  function g6Open(){
    if(!gstRequireLogin('GSTR-6'))return;
    const ctx=gstReturnContext(),d=g6Data();
    const isdRecs=(gstImsSyncSupplierRecords().records||[]).filter(x=>(x.source||'').toUpperCase().includes('ISD'));
    const isdTotal=isdRecs.reduce((s,x)=>s+(+x.igst||0)+(+x.cgst||0)+(+x.sgst||0)+(+x.cess||0),0);
    const distTotal=d.distributions.reduce((s,r)=>s+(+r.igst||0)+(+r.cgst||0)+(+r.sgst||0),0);
    feature('GSTR-6 — Return for Input Service Distributor','Services > Returns > GSTR-6',`
      <div class="gst-dash-head"><h2>GSTR-6, ${esc(ctx.period)}</h2><div class="gst-dash-meta"><span>Status: <b>${esc(d.status)}</b></span><span>Due: 13th of succeeding month</span>${d.arn?`<span>ARN: <b>${esc(d.arn)}</b></span>`:''}</div></div>
      <div class="gst-alert info">For an Input Service Distributor (a head office receiving invoices for input services and distributing the ITC to its branches/units). No tax is paid here — only ITC is received and distributed.</div>
      <div class="gst-section-title">Table 3 — ITC Received for Distribution (from GSTR-2B / IMS, ISD-tagged records)</div>
      <table class="gst-table"><tr><th>Records</th><td>${isdRecs.length}</td><th>IGST</th><td>${gstMoney(isdRecs.reduce((s,x)=>s+(+x.igst||0),0))}</td></tr><tr><th>CGST</th><td>${gstMoney(isdRecs.reduce((s,x)=>s+(+x.cgst||0),0))}</td><th>SGST</th><td>${gstMoney(isdRecs.reduce((s,x)=>s+(+x.sgst||0),0))}</td></tr><tr><th>Total Available for Distribution</th><td colspan="3">${gstMoney(isdTotal)}</td></tr></table>
      <div class="gst-section-title">Table 5 — Distribution of ITC by ISD (Unit-wise)</div>
      <table class="gst-table"><thead><tr><th>Recipient Unit GSTIN</th><th>IGST</th><th>CGST</th><th>SGST</th><th></th></tr></thead><tbody>${d.distributions.map((r,i)=>`<tr><td>${esc(r.gstin)}</td><td>${gstMoney(r.igst)}</td><td>${gstMoney(r.cgst)}</td><td>${gstMoney(r.sgst)}</td><td><a href="#" onclick="event.preventDefault();g6RemoveRow(${i})">Remove</a></td></tr>`).join('')||'<tr><td colspan="5">No distribution rows added yet.</td></tr>'}</tbody></table>
      <div class="gst-form-grid"><div><label>Recipient Unit GSTIN</label><input id="g6_gstin" class="f-input" placeholder="Enter unit GSTIN" maxlength="15" style="text-transform:uppercase"></div><div><label>IGST</label><input id="g6_igst" type="number" class="f-input"></div><div><label>CGST</label><input id="g6_cgst" type="number" class="f-input"></div><div><label>SGST</label><input id="g6_sgst" type="number" class="f-input"></div><div style="align-self:end"><button class="gst-action" onclick="g6AddRow()">+ ADD ROW</button></div></div>
      <div class="gst-alert ${distTotal>isdTotal?'warning':'success'}">Distributed: ${gstMoney(distTotal)} of ${gstMoney(isdTotal)} available.${distTotal>isdTotal?' Distribution exceeds ITC available — please correct before filing.':''}</div>
      <div class="gst-action-row"><button class="gst-action" onclick="g6SaveDraft()">SAVE</button><button class="gst-action secondary" onclick="g6Validate()">VALIDATE</button><button class="gst-action" ${d.status==='Filed'?'disabled':''} onclick="g6File()">FILE GSTR-6</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK</button></div>
      ${d.status==='Filed'?`<div class="gst-alert success">Filed on ${esc(d.filedAt)}. ARN: <b>${esc(d.arn)}</b></div>`:''}
      <div class="gst-note">Training simulator only.</div>`);
  }
  window.g6AddRow=function(){const d=g6Data();const gstin=(document.getElementById('g6_gstin')?.value||'').trim().toUpperCase();if(!gstin){notify('Enter a recipient unit GSTIN first.');return}d.distributions.push({gstin,igst:+document.getElementById('g6_igst').value||0,cgst:+document.getElementById('g6_cgst').value||0,sgst:+document.getElementById('g6_sgst').value||0});g6Save(d);g6Open()};
  window.g6RemoveRow=function(i){const d=g6Data();d.distributions.splice(i,1);g6Save(d);g6Open()};
  window.g6SaveDraft=function(){const d=g6Data();g6Save(d);notify('GSTR-6 draft saved.');g6Open()};
  window.g6Validate=function(){const d=g6Data();if(!d.distributions.length){notify('Add at least one ITC distribution row before validating.');return false}const isdRecs=(gstImsSyncSupplierRecords().records||[]).filter(x=>(x.source||'').toUpperCase().includes('ISD'));const isdTotal=isdRecs.reduce((s,x)=>s+(+x.igst||0)+(+x.cgst||0)+(+x.sgst||0)+(+x.cess||0),0);const distTotal=d.distributions.reduce((s,r)=>s+(+r.igst||0)+(+r.cgst||0)+(+r.sgst||0),0);if(distTotal>isdTotal){notify('Distribution exceeds ITC available for distribution. Correct the amounts before validating.');return false}d.status='Validated';g6Save(d);notify('GSTR-6 validated.');g6Open();return true};
  window.g6File=function(){const d=g6Data();if(d.status!=='Validated'){notify('Validate GSTR-6 before filing.');return}d.status='Filed';d.arn='SIM-GSTR6-'+gstReturnContext().period.replace(/\s+/g,'')+'-'+Math.random().toString(36).slice(2,10).toUpperCase();d.filedAt=new Date().toLocaleString();g6Save(d);window.gstAddFiledReturn&&window.gstAddFiledReturn({reference:d.arn,filedAt:new Date().toISOString(),status:'Filed',filingMode:'Simulated EVC'},'GSTR-6');notify('GSTR-6 filed successfully.');g6Open()};

  function g7Key(){const c=gstReturnContext();return 'gstGstr7_'+c.fy+'_'+c.period.replace(/[^A-Za-z0-9]/g,'_')}
  function g7Data(){return gstRead(g7Key(),{status:'Draft',rows:[],interest:0,lateFee:0,arn:null,filedAt:null})}
  function g7Save(d){gstWrite(g7Key(),d)}
  function g7Open(){
    if(!gstRequireLogin('GSTR-7'))return;
    const ctx=gstReturnContext(),d=g7Data();
    const tdsTotal=d.rows.reduce((s,r)=>s+(+r.igst||0)+(+r.cgst||0)+(+r.sgst||0),0);
    feature('GSTR-7 — Return for Tax Deducted at Source (TDS)','Services > Returns > GSTR-7',`
      <div class="gst-dash-head"><h2>GSTR-7, ${esc(ctx.period)}</h2><div class="gst-dash-meta"><span>Status: <b>${esc(d.status)}</b></span><span>Due: 10th of succeeding month</span>${d.arn?`<span>ARN: <b>${esc(d.arn)}</b></span>`:''}</div></div>
      <div class="gst-alert info">For a TDS deductor under Section 51 (government departments, PSUs, notified persons). Reports tax deducted at source on payments to suppliers, above the ₹2.5 lakh contract-value threshold.</div>
      <div class="gst-section-title">Table 3 — Details of Tax Deducted at Source</div>
      <table class="gst-table"><thead><tr><th>Deductee GSTIN</th><th>Contract / Payment Value</th><th>IGST</th><th>CGST</th><th>SGST</th><th></th></tr></thead><tbody>${d.rows.map((r,i)=>`<tr><td>${esc(r.gstin)}</td><td>${gstMoney(r.value)}</td><td>${gstMoney(r.igst)}</td><td>${gstMoney(r.cgst)}</td><td>${gstMoney(r.sgst)}</td><td><a href="#" onclick="event.preventDefault();g7RemoveRow(${i})">Remove</a></td></tr>`).join('')||'<tr><td colspan="6">No deduction rows added yet.</td></tr>'}</tbody></table>
      <div class="gst-form-grid"><div><label>Deductee GSTIN</label><input id="g7_gstin" class="f-input" maxlength="15" style="text-transform:uppercase"></div><div><label>Contract / Payment Value</label><input id="g7_value" type="number" class="f-input"></div><div><label>IGST (2% total, 1%+1% for CGST/SGST if intra-state)</label></div><div><input id="g7_igst" type="number" class="f-input" placeholder="IGST"></div><div><input id="g7_cgst" type="number" class="f-input" placeholder="CGST"></div><div><input id="g7_sgst" type="number" class="f-input" placeholder="SGST"></div><div style="align-self:end"><button class="gst-action" onclick="g7AddRow()">+ ADD ROW</button></div></div>
      <div class="gst-section-title">Table 6 — Interest, Late Fee &amp; Table 7 — Refund from Cash Ledger</div>
      <table class="gst-table"><tr><th>Total TDS (Table 5 — Liability)</th><td>${gstMoney(tdsTotal)}</td></tr><tr><th>Interest Payable</th><td><input id="g7_int" type="number" class="f-input" value="${d.interest}"></td></tr><tr><th>Late Fee Payable</th><td><input id="g7_lf" type="number" class="f-input" value="${d.lateFee}"></td></tr></table>
      <div class="gst-action-row"><button class="gst-action" onclick="g7SaveDraft()">SAVE</button><button class="gst-action secondary" onclick="g7Validate()">VALIDATE</button><button class="gst-action" ${d.status==='Filed'?'disabled':''} onclick="g7File()">FILE GSTR-7</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK</button></div>
      ${d.status==='Filed'?`<div class="gst-alert success">Filed on ${esc(d.filedAt)}. ARN: <b>${esc(d.arn)}</b></div>`:''}
      <div class="gst-note">Training simulator only. A deductee sees this credit reflected in their Electronic Cash Ledger under "TDS/TCS credit" once filed.</div>`);
  }
  window.g7AddRow=function(){const d=g7Data();const gstin=(document.getElementById('g7_gstin')?.value||'').trim().toUpperCase();const value=+document.getElementById('g7_value')?.value||0;if(!gstin||!value){notify('Enter the deductee GSTIN and contract/payment value first.');return}if(value<250000){notify('TDS under Section 51 applies only where the contract value exceeds ₹2,50,000 — this row is below that threshold.');return}d.rows.push({gstin,value,igst:+document.getElementById('g7_igst').value||0,cgst:+document.getElementById('g7_cgst').value||0,sgst:+document.getElementById('g7_sgst').value||0});g7Save(d);g7Open()};
  window.g7RemoveRow=function(i){const d=g7Data();d.rows.splice(i,1);g7Save(d);g7Open()};
  function g7CollectInputs(){const d=g7Data();d.interest=+document.getElementById('g7_int')?.value||0;d.lateFee=+document.getElementById('g7_lf')?.value||0;return d}
  window.g7SaveDraft=function(){const d=g7CollectInputs();g7Save(d);notify('GSTR-7 draft saved.');g7Open()};
  window.g7Validate=function(){const d=g7CollectInputs();if(!d.rows.length){notify('Add at least one TDS deduction row before validating.');return false}d.status='Validated';g7Save(d);notify('GSTR-7 validated.');g7Open();return true};
  window.g7File=function(){const d=g7CollectInputs();if(d.status!=='Validated'){notify('Validate GSTR-7 before filing.');return}d.status='Filed';d.arn='SIM-GSTR7-'+gstReturnContext().period.replace(/\s+/g,'')+'-'+Math.random().toString(36).slice(2,10).toUpperCase();d.filedAt=new Date().toLocaleString();g7Save(d);window.gstAddFiledReturn&&window.gstAddFiledReturn({reference:d.arn,filedAt:new Date().toISOString(),status:'Filed',filingMode:'Simulated EVC'},'GSTR-7');notify('GSTR-7 filed successfully.');g7Open()};

  function g8Key(){const c=gstReturnContext();return 'gstGstr8_'+c.fy+'_'+c.period.replace(/[^A-Za-z0-9]/g,'_')}
  function g8Data(){return gstRead(g8Key(),{status:'Draft',rows:[],interest:0,arn:null,filedAt:null})}
  function g8Save(d){gstWrite(g8Key(),d)}
  function g8Open(){
    if(!gstRequireLogin('GSTR-8'))return;
    const ctx=gstReturnContext(),d=g8Data();
    const tcsTotal=d.rows.reduce((s,r)=>s+(+r.igst||0)+(+r.cgst||0)+(+r.sgst||0),0);
    feature('GSTR-8 — Statement for E-Commerce Operators (TCS)','Services > Returns > GSTR-8',`
      <div class="gst-dash-head"><h2>GSTR-8, ${esc(ctx.period)}</h2><div class="gst-dash-meta"><span>Status: <b>${esc(d.status)}</b></span><span>Due: 10th of succeeding month</span>${d.arn?`<span>ARN: <b>${esc(d.arn)}</b></span>`:''}</div></div>
      <div class="gst-alert info">For an e-commerce operator required to collect TCS under Section 52 on the net value of taxable supplies made through its platform by other suppliers.</div>
      <div class="gst-section-title">Table 3 — Supplies Made Through the E-Commerce Operator (Net of Returns)</div>
      <table class="gst-table"><thead><tr><th>Supplier GSTIN</th><th>Gross Supply Value</th><th>Value of Supplies Returned</th><th>Net Value</th><th>IGST</th><th>CGST</th><th>SGST</th><th></th></tr></thead><tbody>${d.rows.map((r,i)=>{const net=r.gross-r.returned;return `<tr><td>${esc(r.gstin)}</td><td>${gstMoney(r.gross)}</td><td>${gstMoney(r.returned)}</td><td>${gstMoney(net)}</td><td>${gstMoney(r.igst)}</td><td>${gstMoney(r.cgst)}</td><td>${gstMoney(r.sgst)}</td><td><a href="#" onclick="event.preventDefault();g8RemoveRow(${i})">Remove</a></td></tr>`}).join('')||'<tr><td colspan="8">No supplier rows added yet.</td></tr>'}</tbody></table>
      <div class="gst-form-grid"><div><label>Supplier GSTIN</label><input id="g8_gstin" class="f-input" maxlength="15" style="text-transform:uppercase"></div><div><label>Gross Supply Value</label><input id="g8_gross" type="number" class="f-input"></div><div><label>Value of Supplies Returned</label><input id="g8_returned" type="number" class="f-input" value="0"></div><div><label>IGST (or CGST+SGST) — TCS at 0.5%+0.5%/1%</label></div><div><input id="g8_igst" type="number" class="f-input" placeholder="IGST"></div><div><input id="g8_cgst" type="number" class="f-input" placeholder="CGST"></div><div><input id="g8_sgst" type="number" class="f-input" placeholder="SGST"></div><div style="align-self:end"><button class="gst-action" onclick="g8AddRow()">+ ADD ROW</button></div></div>
      <div class="gst-section-title">Table 6 — Interest on Late Payment of TCS</div>
      <table class="gst-table"><tr><th>Total TCS Collected (Table 5 — Payable)</th><td>${gstMoney(tcsTotal)}</td></tr><tr><th>Interest Payable</th><td><input id="g8_int" type="number" class="f-input" value="${d.interest}"></td></tr></table>
      <div class="gst-action-row"><button class="gst-action" onclick="g8SaveDraft()">SAVE</button><button class="gst-action secondary" onclick="g8Validate()">VALIDATE</button><button class="gst-action" ${d.status==='Filed'?'disabled':''} onclick="g8File()">FILE GSTR-8</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK</button></div>
      ${d.status==='Filed'?`<div class="gst-alert success">Filed on ${esc(d.filedAt)}. ARN: <b>${esc(d.arn)}</b></div>`:''}
      <div class="gst-note">Training simulator only. Suppliers see this TCS reflected as credit in their Electronic Cash Ledger once filed.</div>`);
  }
  window.g8AddRow=function(){const d=g8Data();const gstin=(document.getElementById('g8_gstin')?.value||'').trim().toUpperCase();const gross=+document.getElementById('g8_gross')?.value||0;if(!gstin||!gross){notify('Enter supplier GSTIN and gross supply value first.');return}d.rows.push({gstin,gross,returned:+document.getElementById('g8_returned').value||0,igst:+document.getElementById('g8_igst').value||0,cgst:+document.getElementById('g8_cgst').value||0,sgst:+document.getElementById('g8_sgst').value||0});g8Save(d);g8Open()};
  window.g8RemoveRow=function(i){const d=g8Data();d.rows.splice(i,1);g8Save(d);g8Open()};
  function g8CollectInputs(){const d=g8Data();d.interest=+document.getElementById('g8_int')?.value||0;return d}
  window.g8SaveDraft=function(){const d=g8CollectInputs();g8Save(d);notify('GSTR-8 draft saved.');g8Open()};
  window.g8Validate=function(){const d=g8CollectInputs();if(!d.rows.length){notify('Add at least one supplier row before validating.');return false}d.status='Validated';g8Save(d);notify('GSTR-8 validated.');g8Open();return true};
  window.g8File=function(){const d=g8CollectInputs();if(d.status!=='Validated'){notify('Validate GSTR-8 before filing.');return}d.status='Filed';d.arn='SIM-GSTR8-'+gstReturnContext().period.replace(/\s+/g,'')+'-'+Math.random().toString(36).slice(2,10).toUpperCase();d.filedAt=new Date().toLocaleString();g8Save(d);window.gstAddFiledReturn&&window.gstAddFiledReturn({reference:d.arn,filedAt:new Date().toISOString(),status:'Filed',filingMode:'Simulated EVC'},'GSTR-8');notify('GSTR-8 filed successfully.');g8Open()};

  /* ================= GSTR-10 (Final Return) / GSTR-11 (UIN holders) — built new ================= */
  function g10Data(){return gstRead('gstGstr10',{status:'Draft',cancellationArn:'',cancellationDate:'',stock:{inputs:0,semiFinished:0,finishedGoods:0,capitalGoods:0},taxPayable:0,signatory:'',arn:null,filedAt:null})}
  function g10Save(d){gstWrite('gstGstr10',d)}
  function g10Open(){
    if(!gstRequireLogin('GSTR-10'))return;
    const d=g10Data();
    const stockTax=(d.stock.inputs+d.stock.semiFinished+d.stock.finishedGoods+d.stock.capitalGoods)*0.18;
    feature('GSTR-10 — Final Return','Services > Returns > GSTR-10',`
      <div class="gst-dash-head"><h2>GSTR-10 — Final Return</h2><div class="gst-dash-meta"><span>Status: <b>${esc(d.status)}</b></span><span>Due: within 3 months of cancellation / cancellation order date</span>${d.arn?`<span>ARN: <b>${esc(d.arn)}</b></span>`:''}</div></div>
      <div class="gst-alert warning">A one-time return filed only when GST registration is cancelled or surrendered. It reports closing stock on the date of cancellation and the tax payable on that stock (reversing the ITC claimed on it).</div>
      <div class="gst-section-title">Cancellation Reference</div>
      <table class="gst-table"><tr><th>Cancellation ARN / Order No.</th><td><input id="g10_arn" class="f-input" value="${esc(d.cancellationArn)}" placeholder="Enter cancellation order reference"></td></tr>
      <tr><th>Effective Date of Cancellation</th><td><input id="g10_date" type="date" class="f-input" value="${esc(d.cancellationDate)}"></td></tr></table>
      <div class="gst-section-title">Table 8 — Particulars of Closing Stock &amp; Tax Payable</div>
      <table class="gst-table"><tr><th>Inputs held in stock</th><td><input id="g10_inputs" type="number" class="f-input" value="${d.stock.inputs}"></td></tr>
      <tr><th>Inputs in Semi-Finished Goods</th><td><input id="g10_semi" type="number" class="f-input" value="${d.stock.semiFinished}"></td></tr>
      <tr><th>Inputs in Finished Goods</th><td><input id="g10_fin" type="number" class="f-input" value="${d.stock.finishedGoods}"></td></tr>
      <tr><th>Capital Goods / Plant &amp; Machinery</th><td><input id="g10_cap" type="number" class="f-input" value="${d.stock.capitalGoods}"></td></tr>
      <tr><th>Tax Payable on Closing Stock (illustrative @18%)</th><td>${gstMoney(stockTax)}</td></tr></table>
      <div class="gst-section-title">Table 9 — Verification</div>
      <table class="gst-table"><tr><th>Name of Authorized Signatory</th><td><input id="g10_sign" class="f-input" value="${esc(d.signatory)}"></td></tr></table>
      <div class="gst-action-row"><button class="gst-action" onclick="g10SaveDraft()">SAVE</button><button class="gst-action secondary" onclick="g10Validate()">VALIDATE</button><button class="gst-action" ${d.status==='Filed'?'disabled':''} onclick="g10File()">FILE GSTR-10</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK</button></div>
      ${d.status==='Filed'?`<div class="gst-alert success">Filed on ${esc(d.filedAt)}. ARN: <b>${esc(d.arn)}</b>. This closes the registration lifecycle in this training simulator.</div>`:''}
      <div class="gst-note">Training simulator only. Filed once, per GSTIN, unlike every other return in this list.</div>`);
  }
  function g10CollectInputs(){const d=g10Data();d.cancellationArn=document.getElementById('g10_arn')?.value||'';d.cancellationDate=document.getElementById('g10_date')?.value||'';d.stock={inputs:+document.getElementById('g10_inputs')?.value||0,semiFinished:+document.getElementById('g10_semi')?.value||0,finishedGoods:+document.getElementById('g10_fin')?.value||0,capitalGoods:+document.getElementById('g10_cap')?.value||0};d.signatory=document.getElementById('g10_sign')?.value||'';return d}
  window.g10SaveDraft=function(){const d=g10CollectInputs();g10Save(d);notify('GSTR-10 draft saved.');g10Open()};
  window.g10Validate=function(){const d=g10CollectInputs();if(!d.cancellationArn||!d.cancellationDate){notify('Enter the cancellation order reference and effective date before validating.');return false}if(!d.signatory){notify('Enter the Authorized Signatory name in Table 9 before validating.');return false}d.status='Validated';g10Save(d);notify('GSTR-10 validated.');g10Open();return true};
  window.g10File=function(){const d=g10CollectInputs();if(d.status!=='Validated'){notify('Validate GSTR-10 before filing.');return}d.status='Filed';d.arn='SIM-GSTR10-'+new Date().getFullYear()+'-'+Math.random().toString(36).slice(2,10).toUpperCase();d.filedAt=new Date().toLocaleString();g10Save(d);window.gstAddFiledReturn&&window.gstAddFiledReturn({reference:d.arn,filedAt:new Date().toISOString(),status:'Filed',fy:gstReturnContext().fy,period:'Final Return',filingMode:'Simulated EVC'},'GSTR-10');notify("GSTR-10 filed successfully. This GSTIN's return-filing lifecycle is now closed in the simulator.");g10Open()};

  function g11Key(){const c=gstReturnContext();return 'gstGstr11_'+c.fy+'_'+c.period.replace(/[^A-Za-z0-9]/g,'_')}
  function g11Data(){return gstRead(g11Key(),{status:'Draft',rows:[],arn:null,filedAt:null})}
  function g11Save(d){gstWrite(g11Key(),d)}
  function g11Open(){
    if(!gstRequireLogin('GSTR-11'))return;
    const ctx=gstReturnContext(),d=g11Data();
    const refundTotal=d.rows.reduce((s,r)=>s+(+r.igst||0)+(+r.cgst||0)+(+r.sgst||0),0);
    feature('GSTR-11 — Statement of Inward Supplies by UIN Holders','Services > Returns > GSTR-11',`
      <div class="gst-dash-head"><h2>GSTR-11, ${esc(ctx.period)}</h2><div class="gst-dash-meta"><span>Status: <b>${esc(d.status)}</b></span><span>Filed by: UIN holders (foreign embassies, UN bodies, notified agencies)</span>${d.arn?`<span>ARN: <b>${esc(d.arn)}</b></span>`:''}</div></div>
      <div class="gst-alert info">Filed by entities holding a Unique Identity Number (UIN) — e.g. foreign diplomatic missions and UN agencies — to claim a refund of GST paid on their purchases in India. No output tax liability arises for a UIN holder.</div>
      <div class="gst-section-title">Table 3 — Details of Inward Supplies Received</div>
      <table class="gst-table"><thead><tr><th>Supplier GSTIN</th><th>Invoice No.</th><th>Taxable Value</th><th>IGST</th><th>CGST</th><th>SGST</th><th></th></tr></thead><tbody>${d.rows.map((r,i)=>`<tr><td>${esc(r.gstin)}</td><td>${esc(r.invoice)}</td><td>${gstMoney(r.taxable)}</td><td>${gstMoney(r.igst)}</td><td>${gstMoney(r.cgst)}</td><td>${gstMoney(r.sgst)}</td><td><a href="#" onclick="event.preventDefault();g11RemoveRow(${i})">Remove</a></td></tr>`).join('')||'<tr><td colspan="7">No inward supply rows added yet.</td></tr>'}</tbody></table>
      <div class="gst-form-grid"><div><label>Supplier GSTIN</label><input id="g11_gstin" class="f-input" maxlength="15" style="text-transform:uppercase"></div><div><label>Invoice No.</label><input id="g11_inv" class="f-input"></div><div><label>Taxable Value</label><input id="g11_taxable" type="number" class="f-input"></div><div><input id="g11_igst" type="number" class="f-input" placeholder="IGST"></div><div><input id="g11_cgst" type="number" class="f-input" placeholder="CGST"></div><div><input id="g11_sgst" type="number" class="f-input" placeholder="SGST"></div><div style="align-self:end"><button class="gst-action" onclick="g11AddRow()">+ ADD ROW</button></div></div>
      <div class="gst-alert success">Total Refund Claim: ${gstMoney(refundTotal)}</div>
      <div class="gst-action-row"><button class="gst-action" onclick="g11SaveDraft()">SAVE</button><button class="gst-action secondary" onclick="g11Validate()">VALIDATE</button><button class="gst-action" ${d.status==='Filed'?'disabled':''} onclick="g11File()">FILE GSTR-11</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK</button></div>
      ${d.status==='Filed'?`<div class="gst-alert success">Filed on ${esc(d.filedAt)}. ARN: <b>${esc(d.arn)}</b>. Refund claim of ${gstMoney(refundTotal)} initiated.</div>`:''}
      <div class="gst-note">Training simulator only.</div>`);
  }
  window.g11AddRow=function(){const d=g11Data();const gstin=(document.getElementById('g11_gstin')?.value||'').trim().toUpperCase();const inv=(document.getElementById('g11_inv')?.value||'').trim();if(!gstin||!inv){notify('Enter supplier GSTIN and invoice number first.');return}d.rows.push({gstin,invoice:inv,taxable:+document.getElementById('g11_taxable').value||0,igst:+document.getElementById('g11_igst').value||0,cgst:+document.getElementById('g11_cgst').value||0,sgst:+document.getElementById('g11_sgst').value||0});g11Save(d);g11Open()};
  window.g11RemoveRow=function(i){const d=g11Data();d.rows.splice(i,1);g11Save(d);g11Open()};
  window.g11SaveDraft=function(){const d=g11Data();g11Save(d);notify('GSTR-11 draft saved.');g11Open()};
  window.g11Validate=function(){const d=g11Data();if(!d.rows.length){notify('Add at least one inward supply row before validating.');return false}d.status='Validated';g11Save(d);notify('GSTR-11 validated.');g11Open();return true};
  window.g11File=function(){const d=g11Data();if(d.status!=='Validated'){notify('Validate GSTR-11 before filing.');return}d.status='Filed';d.arn='SIM-GSTR11-'+gstReturnContext().period.replace(/\s+/g,'')+'-'+Math.random().toString(36).slice(2,10).toUpperCase();d.filedAt=new Date().toLocaleString();g11Save(d);window.gstAddFiledReturn&&window.gstAddFiledReturn({reference:d.arn,filedAt:new Date().toISOString(),status:'Filed',filingMode:'Simulated EVC'},'GSTR-11');notify('GSTR-11 filed successfully. Refund claim recorded.');g11Open()};

  (function(){
    const _fn5=window.featureNav;
    window.featureNav=function(label){ if(['GSTR-6','GSTR-7','GSTR-8','GSTR-10','GSTR-11'].includes(label)){ if(typeof window.gstRequireLogin==='function' && !window.gstRequireLogin(label)) return; if(label==='GSTR-6')return g6Open(); if(label==='GSTR-7')return g7Open(); if(label==='GSTR-8')return g8Open(); if(label==='GSTR-10')return g10Open(); return g11Open(); } return _fn5(label); };
    const _openReturn5=window.gstOpenReturn;
    window.gstOpenReturn=function(name){ if(name==='GSTR-6')return g6Open(); if(name==='GSTR-7')return g7Open(); if(name==='GSTR-8')return g8Open(); if(name==='GSTR-10')return g10Open(); if(name==='GSTR-11')return g11Open(); return _openReturn5(name); };
  })();

  (function(){
    const _fn4=window.featureNav;
    window.featureNav=function(label){ if(['GSTR-4','GSTR-5','GSTR-5A'].includes(label)){ if(typeof window.gstRequireLogin==='function' && !window.gstRequireLogin(label)) return; if(label==='GSTR-4')return g4Open(); if(label==='GSTR-5')return g5Open(); return g5aOpen(); } return _fn4(label); };
    const _openReturn4=window.gstOpenReturn;
    window.gstOpenReturn=function(name){ if(name==='GSTR-4')return g4Open(document.getElementById('gstFY')?.value); if(name==='GSTR-5')return g5Open(); if(name==='GSTR-5A')return g5aOpen(); return _openReturn4(name); };
  })();

  /* ================= REFUND WORKFLOW ENGINE ================= */
  function refundRead(){return gstRead('gstRefundState',{applications:[],bankAccounts:[{id:'BA-DEMO-01',bank:'Demo Bank',account:'XXXXXX4582',ifsc:'DEMO0001234',status:'Verified'}],exportLedger:[],notifications:[]})}
  function refundWrite(v){gstWrite('gstRefundState',v)}
  function refundMoney(n){return '₹'+(Number(n||0)).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}
  function refundEsc(v){return esc(String(v??''))}
  function refundArn(){return 'SIM-RFD01-'+new Date().getFullYear()+'-'+Math.random().toString(36).slice(2,10).toUpperCase()}
  function refundStageIndex(status){const a=['Refund Application Filed','Bank Account validation pending at PFMS','Bank Account Validated','Refund Application Acknowledged','Deficiency Memo Issued','Provisional Refund Order Issued','Show Cause Notice Issued','Reply received- Pending for Order','Refund Sanctioned','Refund Partially Sanctioned','Refund Rejected','Payment Advice Issued','Disbursement request sent to PFMS','Payment request sent to Bank','Refund disbursed successfully'];const i=a.indexOf(status);return i<0?0:i}
  function refundStatusLabel(app){return app.status||'Draft'}
  function refundDefault(){return {id:'',arn:'',category:'',period:'',fy:'2026-27',claim:0,eligible:0,bankId:'BA-DEMO-01',remarks:'',declaration:false,status:'Draft',bankStatus:'Not Sent',stage:0,createdAt:'',filedAt:'',ackAt:'',rfd02:'',rfd03:'',rfd04:'',rfd05:'',rfd06:'',scn:'',reply:'',sanctioned:0,provisional:0,disbursed:0,documents:[],events:[],validation:{},invoiceData:[],exportStatus:'Not applicable',withdrawn:false}}
  function refundGet(id){const st=refundRead();return st.applications.find(x=>x.id===id)}
  function refundSaveApp(app){const st=refundRead();const i=st.applications.findIndex(x=>x.id===app.id);if(i>=0)st.applications[i]=app;else st.applications.push(app);refundWrite(st);return app}
  function refundEvent(app,action,from,to,ref){app.events=app.events||[];app.events.push({at:new Date().toLocaleString(),user:'Demo Taxpayer',action,from:from||'',to:to||'',reference:ref||app.arn||app.id})}
  function refundNotify(app,msg){const st=refundRead();st.notifications.push({at:new Date().toLocaleString(),arn:app.arn||app.id,message:msg});refundWrite(st)}
  function refundRender(id){const app=refundGet(id);if(!app)return refundApply();
    const st=refundRead();
    const stages=[['1','Application Filed'],['2','PFMS Bank Validation'],['3','Officer Processing'],['4','Acknowledgement / Deficiency'],['5','Provisional / Final Order'],['6','Payment Advice'],['7','PFMS Disbursement']];
    const idx=refundStageIndex(app.status);
    const timeline=stages.map((x,i)=>`<div class="status-step ${i<=(app.status==='Refund Rejected'?4:Math.min(6,Math.floor(idx/2)))?'done':''} ${i===Math.min(6,Math.floor(idx/2))?'current':''}"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('');
    const docs=(app.documents||[]).map((d,i)=>`<tr><td>${refundEsc(d.name)}</td><td>${refundEsc(d.type)}</td><td>${refundEsc(d.size)}</td><td><button class="gst-action secondary" onclick="refundRemoveDoc('${app.id}',${i})">DELETE</button></td></tr>`).join('')||'<tr><td colspan="4">No supporting documents added.</td></tr>';
    const events=(app.events||[]).slice().reverse().map(e=>`<tr><td>${refundEsc(e.at)}</td><td>${refundEsc(e.action)}</td><td>${refundEsc(e.from)}</td><td>${refundEsc(e.to)}</td><td>${refundEsc(e.reference)}</td></tr>`).join('')||'<tr><td colspan="5">No audit events.</td></tr>';
    const bank=st.bankAccounts.find(x=>x.id===app.bankId)||st.bankAccounts[0];
    feature('Refund Application — GST RFD-01',`Services > Refunds > ${app.arn||'New Application'}`,`
      <div class="gst-dash-head"><h2>Refund Application</h2><div class="gst-dash-meta"><span>ARN: <b>${refundEsc(app.arn||'Not generated')}</b></span><span>Status: <b>${refundEsc(refundStatusLabel(app))}</b></span><span>Claimed: <b>${refundMoney(app.claim)}</b></span></div></div>
      <div class="gst-alert info"><b>TRAINING SIMULATOR.</b> RFD-01, RFD-02, RFD-03, RFD-04, RFD-05, RFD-06, PFMS and officer actions are simulated locally. No real refund application is transmitted.</div>
      <div class="status-bar">${timeline}</div>
      <div class="gst-section-title">1. Refund Details</div>
      <div class="gst-form-grid">
        <div><label>Refund Category *</label><select id="rfCat" class="f-select" ${app.status!=='Draft'?'disabled':''}><option ${app.category==='Export of goods/services without payment of tax'?'selected':''}>Export of goods/services without payment of tax</option><option ${app.category==='Export of goods/services with payment of tax'?'selected':''}>Export of goods/services with payment of tax</option><option ${app.category==='Inverted tax structure'?'selected':''}>Inverted tax structure</option><option ${app.category==='Deemed exports'?'selected':''}>Deemed exports</option><option ${app.category==='Excess balance in Electronic Cash Ledger'?'selected':''}>Excess balance in Electronic Cash Ledger</option><option ${app.category==='Refund on account of appeal / provisional assessment / other eligible grounds'?'selected':''}>Refund on account of appeal / provisional assessment / other eligible grounds</option></select></div>
        <div><label>Financial Year *</label><select id="rfFY" class="f-select" ${app.status!=='Draft'?'disabled':''}><option ${app.fy==='2026-27'?'selected':''}>2026-27</option><option ${app.fy==='2025-26'?'selected':''}>2025-26</option></select></div>
        <div><label>Tax Period *</label><input id="rfPeriod" class="f-input" type="month" value="${refundEsc(app.period)}" ${app.status!=='Draft'?'disabled':''}></div>
        <div><label>Refund Claimed *</label><input id="rfClaim" class="f-input" type="number" min="0" step="0.01" value="${app.claim||''}" ${app.status!=='Draft'?'disabled':''}></div>
        <div><label>Eligible Refund (simulated)</label><input id="rfEligible" class="f-input" type="number" min="0" step="0.01" value="${app.eligible||''}" ${app.status!=='Draft'?'disabled':''}></div>
        <div style="grid-column:1/-1"><label>Remarks / Grounds</label><textarea id="rfRemarks" class="f-input" style="min-height:90px" ${app.status!=='Draft'?'disabled':''}>${refundEsc(app.remarks)}</textarea></div>
      </div>
      <div class="gst-section-title">2. Bank Account for Refund</div>
      <div class="gst-form-grid"><div><label>Selected Account *</label><select id="rfBank" class="f-select" ${app.status!=='Draft'?'disabled':''}>${st.bankAccounts.map(b=>`<option value="${refundEsc(b.id)}" ${b.id===app.bankId?'selected':''}>${refundEsc(b.bank)} • ${refundEsc(b.account)} • ${refundEsc(b.ifsc)} • ${refundEsc(b.status)}</option>`).join('')}</select></div><div><label>PFMS Bank Validation</label><input class="f-input" value="${refundEsc(app.bankStatus)}" disabled></div></div>
      <div class="gst-section-title">3. Statements / Supporting Documents</div>
      <div class="gst-form-grid"><div><label>Document Name</label><input id="rfDocName" class="f-input" placeholder="Invoice statement / declaration / supporting document"></div><div><label>Document Type</label><select id="rfDocType" class="f-select"><option>Statement</option><option>Invoice Evidence</option><option>Declaration</option><option>Export Evidence</option><option>Other Supporting Document</option></select></div><div><label>Simulated Size</label><input id="rfDocSize" class="f-input" placeholder="250 KB"></div><div><button class="gst-action secondary" onclick="refundAddDoc('${app.id}')">ADD DOCUMENT</button></div></div>
      <table class="gst-table"><thead><tr><th>Document</th><th>Type</th><th>Size</th><th>Action</th></tr></thead><tbody>${docs}</tbody></table>
      <div class="gst-section-title">4. Declaration & Verification</div>
      <label style="display:block;margin:10px 0"><input id="rfDecl" type="checkbox" ${app.declaration?'checked':''} ${app.status!=='Draft'?'disabled':''}> I declare that the information furnished in this refund application is true and correct.</label>
      <div class="gst-action-row">${app.status==='Draft'?`<button class="gst-action secondary" onclick="refundSaveDraft('${app.id}')">SAVE DRAFT</button><button class="gst-action" onclick="refundFile('${app.id}')">SUBMIT / FILE RFD-01</button>`:''}<button class="gst-action secondary" onclick="refundTrack('${app.id}')">TRACK APPLICATION</button><button class="gst-action secondary" onclick="refundDownload('${app.id}','RFD-01')">PREVIEW / DOWNLOAD RFD-01</button><button class="gst-action secondary" onclick="refundBank('${app.id}')">UPDATE BANK ACCOUNT</button>${app.bankStatus==='Bank Account validation pending at PFMS'?`<button class="gst-action" onclick="refundPFMSValidate('${app.id}','success')">SIMULATE PFMS VALIDATION</button><button class="gst-action secondary" onclick="refundPFMSValidate('${app.id}','fail')">SIMULATE PFMS FAILURE</button>`:''}</div>
      <div class="gst-alert ${app.status==='Refund Rejected'?'error':app.status==='Refund disbursed successfully'?'success':'info'}"><b>Current Status:</b> ${refundEsc(app.status)}${app.arn?`<br>ARN: <b>${refundEsc(app.arn)}</b>`:''}</div>
      <div class="gst-section-title">5. Tax Officer / Processing Simulation</div>
      <div class="gst-action-row">${app.status==='Bank Account Validated'?`<button class="gst-action" onclick="refundOfficerAck('${app.id}')">ISSUE RFD-02</button><button class="gst-action secondary" onclick="refundOfficerDeficiency('${app.id}')">ISSUE RFD-03</button>`:''}${app.status==='Deficiency Memo Issued'?`<button class="gst-action" onclick="refundRectifyDeficiency('${app.id}')">RECTIFY DEFICIENCY & RESUBMIT</button>`:''}${app.status==='Refund Application Acknowledged'?`<button class="gst-action" onclick="refundOfficerProvisional('${app.id}')">ISSUE RFD-04</button><button class="gst-action" onclick="refundOfficerSCN('${app.id}')">ISSUE RFD-08 / SCN</button><button class="gst-action" onclick="refundOfficerFinal('${app.id}','sanction')">ISSUE RFD-06 — SANCTION</button><button class="gst-action secondary" onclick="refundOfficerFinal('${app.id}','partial')">PARTIAL SANCTION</button><button class="gst-action secondary" onclick="refundOfficerFinal('${app.id}','reject')">REJECT</button>`:''}${app.status==='Show Cause Notice Issued'?`<button class="gst-action" onclick="refundReply('${app.id}')">SUBMIT RFD-09 REPLY</button>`:''}${app.status==='Provisional Refund Order Issued'||app.status==='Refund Sanctioned'||app.status==='Refund Partially Sanctioned'?`<button class="gst-action" onclick="refundIssuePayment('${app.id}')">ISSUE RFD-05 / PAYMENT ADVICE</button>`:''}${app.status==='Payment Advice Issued'?`<button class="gst-action" onclick="refundPFMSDisburse('${app.id}')">SEND TO PFMS / DISBURSE</button>`:''}</div>
      <div class="gst-section-title">6. Application Audit Trail</div><table class="gst-table"><thead><tr><th>Timestamp</th><th>Action</th><th>Old Status</th><th>New Status</th><th>Reference</th></tr></thead><tbody>${events}</tbody></table>`);
  }
  function refundApply(){const st=refundRead();const draft=st.applications.find(x=>x.status==='Draft')||null;const app=draft||Object.assign(refundDefault(),{id:'RFD-DRAFT-'+Date.now(),createdAt:new Date().toLocaleString()});if(!draft)refundSaveApp(app);refundRender(app.id)}
  // Bug fix: the real, full RFD-01 -> RFD-09 workflow above is declared inside this IIFE,
  // so it never overwrote the old, dead 3-field placeholder `function refundApply(){}`
  // declared at the top level of the script — the 'Refunds' menu entry (and every other
  // caller outside this IIFE) was calling that placeholder the whole time, and the
  // fully-built refund system was unreachable through normal navigation. Exposing it here
  // makes this the one true global `refundApply`, matching how every other module in this
  // file gets wired up.
  window.refundApply=refundApply;
  window.refundSaveDraft=function(id){const app=refundGet(id);if(!app)return;app.category=document.getElementById('rfCat')?.value||'';app.fy=document.getElementById('rfFY')?.value||'2026-27';app.period=document.getElementById('rfPeriod')?.value||'';app.claim=+(document.getElementById('rfClaim')?.value||0);app.eligible=+(document.getElementById('rfEligible')?.value||0);app.remarks=document.getElementById('rfRemarks')?.value||'';app.bankId=document.getElementById('rfBank')?.value||app.bankId;app.declaration=!!document.getElementById('rfDecl')?.checked;refundSaveApp(app);refundEvent(app,'Save Draft','Draft','Draft',app.id);refundSaveApp(app);refundRender(id);notify('RFD-01 draft saved.');}
  window.refundFile=function(id){const app=refundGet(id);if(!app)return;app.category=document.getElementById('rfCat')?.value||'';app.fy=document.getElementById('rfFY')?.value||'';app.period=document.getElementById('rfPeriod')?.value||'';app.claim=+(document.getElementById('rfClaim')?.value||0);app.eligible=+(document.getElementById('rfEligible')?.value||app.claim);app.remarks=document.getElementById('rfRemarks')?.value||'';app.bankId=document.getElementById('rfBank')?.value||app.bankId;app.declaration=!!document.getElementById('rfDecl')?.checked;const errs=[];if(!app.category)errs.push('Select a refund category.');if(!app.period)errs.push('Select the tax period.');if(app.claim<=0)errs.push('Enter a refund amount greater than zero.');if(app.eligible<0||app.eligible>app.claim)errs.push('Eligible refund cannot be negative or greater than the amount claimed.');if(!app.declaration)errs.push('Accept the declaration.');const bank=refundRead().bankAccounts.find(x=>x.id===app.bankId);if(!bank)errs.push('Select a bank account.');if(errs.length){notify(errs[0]);refundRender(id);return}app.arn=refundArn();app.status='Refund Application Filed';app.stage=1;app.filedAt=new Date().toLocaleString();app.createdAt=app.createdAt||app.filedAt;refundEvent(app,'File RFD-01','Draft','Refund Application Filed',app.arn);refundSaveApp(app);refundNotify(app,'Refund application filed. Bank account sent to PFMS for validation.');app.bankStatus='Bank Account validation pending at PFMS';refundEvent(app,'PFMS Bank Validation Request','Refund Application Filed','Bank Account validation pending at PFMS',app.arn);refundSaveApp(app);refundRender(id);}
  window.refundBank=function(id){const app=refundGet(id);const st=refundRead();feature('Update Bank Account — Refund','Services > Refunds > Track Application Status',`<div class="gst-alert info">Official GST guidance states that when PFMS bank validation fails, the taxpayer can update the bank account and the account is validated again.</div><div class="gst-form-grid"><div><label>Bank Name *</label><input id="ubBank" class="f-input" value="${refundEsc(st.bankAccounts[0]?.bank||'Demo Bank')}"></div><div><label>Account Number *</label><input id="ubAcc" class="f-input" placeholder="Demo account number"></div><div><label>Account Type *</label><select id="ubType" class="f-select"><option>Current</option><option>Savings</option></select></div><div><label>IFSC *</label><input id="ubIfsc" class="f-input" placeholder="DEMO0001234"></div></div><div class="gst-action-row"><button class="gst-action" onclick="refundAddBank('${id}')">VALIDATE & UPDATE BANK ACCOUNT</button><button class="gst-action secondary" onclick="refundRender('${id}')">BACK</button></div><div class="gst-alert warning">Simulation only. No bank account is transmitted to PFMS.</div>`)}
  window.refundAddBank=function(id){const app=refundGet(id),st=refundRead(),bank={id:'BA-'+Date.now(),bank:document.getElementById('ubBank')?.value.trim(),account:'XXXXXX'+(document.getElementById('ubAcc')?.value||'').slice(-4),ifsc:document.getElementById('ubIfsc')?.value.trim().toUpperCase(),status:'Validation Pending'};if(!bank.bank||!document.getElementById('ubAcc')?.value||!bank.ifsc){notify('Complete bank name, account number and IFSC.');return}if(!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bank.ifsc)){notify('Enter a valid IFSC format for the simulation.');return}bank.status='Verified';st.bankAccounts.push(bank);app.bankId=bank.id;app.bankStatus='Bank Account Validated';if(app.status==='Bank Account validation failed')app.status='Bank Account Validated';refundEvent(app,'Update Bank Account','Bank Account validation failed','Bank Account Validated',app.arn);refundWrite(st);refundSaveApp(app);refundRender(id);notify('Bank account updated and validated in simulation.');}
  window.refundAddDoc=function(id){const app=refundGet(id);if(!app)return;const name=document.getElementById('rfDocName')?.value.trim(),type=document.getElementById('rfDocType')?.value,size=document.getElementById('rfDocSize')?.value.trim()||'250 KB';if(!name){notify('Enter a supporting document name.');return}app.documents=app.documents||[];app.documents.push({name,type,size});refundSaveApp(app);refundRender(id)}
  window.refundRemoveDoc=function(id,i){const app=refundGet(id);if(!app)return;app.documents.splice(i,1);refundSaveApp(app);refundRender(id)}
  window.refundTrack=function(id){const app=refundGet(id);if(!app)return;feature('Track Refund Application Status','Services > Refunds > Track Application Status',`<div class="gst-dash-head"><h2>Track Refund Application</h2><div class="gst-dash-meta"><span>ARN: <b>${refundEsc(app.arn||'Not filed')}</b></span><span>FY: <b>${refundEsc(app.fy)}</b></span><span>Tax Period: <b>${refundEsc(app.period||'')}</b></span></div></div><div class="gst-alert info">Official tracking supports ARN or Filing Year after login. Pre-login tracking is available by ARN.</div><div class="status-bar"><div class="status-step done">Filed</div><div class="status-step ${app.bankStatus==='Bank Account validation pending at PFMS'?'current':'done'}">PFMS Bank Validation</div><div class="status-step ${['Refund Application Acknowledged','Deficiency Memo Issued','Provisional Refund Order Issued','Refund Sanctioned','Refund Partially Sanctioned','Refund Rejected','Show Cause Notice Issued','Reply received- Pending for Order','Payment Advice Issued','Disbursement request sent to PFMS','Payment request sent to Bank','Refund disbursed successfully'].includes(app.status)?'current':''}">Officer Processing</div><div class="status-step ${['Payment Advice Issued','Disbursement request sent to PFMS','Payment request sent to Bank','Refund disbursed successfully'].includes(app.status)?'current':''}">PFMS Disbursement</div><div class="status-step ${app.status==='Refund disbursed successfully'?'done current':''}">Completed</div></div><table class="gst-table"><tr><th>Current Status</th><td>${refundEsc(app.status)}</td></tr><tr><th>Claimed</th><td>${refundMoney(app.claim)}</td></tr><tr><th>Eligible / Sanctioned</th><td>${refundMoney(app.sanctioned||app.eligible)}</td></tr><tr><th>Bank Validation</th><td>${refundEsc(app.bankStatus)}</td></tr><tr><th>RFD-02</th><td>${refundEsc(app.rfd02||'—')}</td></tr><tr><th>RFD-03</th><td>${refundEsc(app.rfd03||'—')}</td></tr><tr><th>RFD-04</th><td>${refundEsc(app.rfd04||'—')}</td></tr><tr><th>RFD-05</th><td>${refundEsc(app.rfd05||'—')}</td></tr><tr><th>RFD-06</th><td>${refundEsc(app.rfd06||'—')}</td></tr></table><div class="gst-action-row"><button class="gst-action secondary" onclick="refundRender('${id}')">OPEN APPLICATION</button><button class="gst-action secondary" onclick="refundDownload('${id}','REFUND STATUS')">DOWNLOAD STATUS</button>${app.bankStatus==='Bank Account validation failed'?`<button class="gst-action" onclick="refundBank('${id}')">UPDATE BANK ACCOUNT</button>`:''}</div>`)}
  window.refundPFMSValidate=function(id,result){const app=refundGet(id);if(!app||app.bankStatus!=='Bank Account validation pending at PFMS')return;if(result==='fail'){app.bankStatus='Bank Account validation failed';app.status='Bank Account validation failed';refundEvent(app,'PFMS Bank Validation','Bank Account validation pending at PFMS','Bank Account validation failed',app.arn);refundNotify(app,'PFMS bank validation failed. Update the bank account and retry validation.');}else{const bank=refundRead().bankAccounts.find(x=>x.id===app.bankId);app.bankStatus='Bank Account Validated';app.status='Bank Account Validated';refundEvent(app,'PFMS Bank Validation','Bank Account validation pending at PFMS','Bank Account Validated',app.arn);refundNotify(app,'PFMS bank validation successful.');}refundSaveApp(app);refundRender(id)}
  window.refundRectifyDeficiency=function(id){const app=refundGet(id);if(!app||app.status!=='Deficiency Memo Issued')return;app.status='Bank Account Validated';app.rfd03=app.rfd03||'SIM-RFD-03-'+Date.now();refundEvent(app,'Rectify Deficiency','Deficiency Memo Issued','Bank Account Validated',app.rfd03);refundSaveApp(app);refundRender(id);notify('Deficiency rectified in simulation. Application can proceed to RFD-02.')}
  window.refundOfficerAck=function(id){const app=refundGet(id);if(!app||app.status!=='Bank Account Validated')return;app.status='Refund Application Acknowledged';app.ackAt=new Date().toLocaleString();app.rfd02='SIM-RFD-02-'+Date.now();refundEvent(app,'Issue RFD-02','Bank Account Validated','Refund Application Acknowledged',app.rfd02);refundSaveApp(app);refundNotify(app,'RFD-02 acknowledgement issued.');refundRender(id)}
  window.refundOfficerDeficiency=function(id){const app=refundGet(id);if(!app||app.status!=='Bank Account Validated')return;app.status='Deficiency Memo Issued';app.rfd03='SIM-RFD-03-'+Date.now();refundEvent(app,'Issue RFD-03','Bank Account Validated','Deficiency Memo Issued',app.rfd03);refundSaveApp(app);refundNotify(app,'Deficiency Memo issued. Training flow requires rectification before further processing.');refundRender(id)}
  window.refundOfficerProvisional=function(id){const app=refundGet(id);if(!app||app.status!=='Refund Application Acknowledged')return;app.status='Provisional Refund Order Issued';app.rfd04='SIM-RFD-04-'+Date.now();app.provisional=Math.min(app.eligible,app.claim);refundEvent(app,'Issue RFD-04','Refund Application Acknowledged','Provisional Refund Order Issued',app.rfd04);refundSaveApp(app);refundRender(id)}
  window.refundOfficerSCN=function(id){const app=refundGet(id);if(!app||app.status!=='Refund Application Acknowledged')return;app.status='Show Cause Notice Issued';app.scn='SIM-RFD-08-'+Date.now();refundEvent(app,'Issue RFD-08 / SCN','Refund Application Acknowledged','Show Cause Notice Issued',app.scn);refundSaveApp(app);refundNotify(app,'Show Cause Notice issued. Submit RFD-09 reply in the simulator.');refundRender(id)}
  window.refundReply=function(id){const app=refundGet(id);if(!app||app.status!=='Show Cause Notice Issued')return;feature('Reply to Show Cause Notice — RFD-09','Refund > Proceedings',`<div class="gst-alert warning">RFD-08 / SCN Reference: <b>${refundEsc(app.scn)}</b></div><label>Reply / Clarification *</label><textarea id="rfReply" class="f-input" style="min-height:140px" placeholder="Enter simulated reply / clarification"></textarea><div class="gst-action-row"><button class="gst-action" onclick="refundSubmitReply('${id}')">SUBMIT RFD-09 REPLY</button><button class="gst-action secondary" onclick="refundRender('${id}')">BACK</button></div>`)}
  window.refundSubmitReply=function(id){const app=refundGet(id),reply=document.getElementById('rfReply')?.value.trim();if(!reply){notify('Enter the reply / clarification.');return}app.reply=reply;app.status='Reply received- Pending for Order';refundEvent(app,'Submit RFD-09 Reply','Show Cause Notice Issued','Reply received- Pending for Order',app.scn);refundSaveApp(app);refundRender(id)}
  window.refundOfficerFinal=function(id,mode){const app=refundGet(id);if(!app||!['Refund Application Acknowledged','Reply received- Pending for Order','Provisional Refund Order Issued'].includes(app.status))return;if(mode==='reject'){app.status='Refund Rejected';app.sanctioned=0}else if(mode==='partial'){app.status='Refund Partially Sanctioned';app.sanctioned=Math.max(0,Math.min(app.claim,app.eligible*0.7))}else{app.status='Refund Sanctioned';app.sanctioned=Math.max(0,Math.min(app.claim,app.eligible))}app.rfd06='SIM-RFD-06-'+Date.now();refundEvent(app,'Issue RFD-06',app.status==='Refund Rejected'?'Processing Complete':'Processing',app.status,app.rfd06);refundSaveApp(app);refundRender(id)}
  window.refundIssuePayment=function(id){const app=refundGet(id);if(!app||!['Provisional Refund Order Issued','Refund Sanctioned','Refund Partially Sanctioned'].includes(app.status))return;app.status='Payment Advice Issued';app.rfd05='SIM-RFD-05-'+Date.now();refundEvent(app,'Issue RFD-05 / Payment Advice',app.status,'Payment Advice Issued',app.rfd05);refundSaveApp(app);refundNotify(app,'Payment Advice sent to simulated PFMS.');refundRender(id)}
  window.refundPFMSDisburse=function(id){const app=refundGet(id);if(!app||app.status!=='Payment Advice Issued')return;app.status='Disbursement request sent to PFMS';refundEvent(app,'Send Disbursement Request','Payment Advice Issued','Disbursement request sent to PFMS',app.rfd05);refundSaveApp(app);refundRender(id);setTimeout(()=>{const a=refundGet(id);if(!a)return;a.status='Payment request sent to Bank';refundEvent(a,'PFMS Accepted','Disbursement request sent to PFMS','Payment request sent to Bank',a.rfd05);refundSaveApp(a);refundRender(id);setTimeout(()=>{const b=refundGet(id);if(!b)return;b.status='Refund disbursed successfully';b.disbursed=b.sanctioned||b.eligible||0;refundEvent(b,'Refund Disbursed','Payment request sent to Bank','Refund disbursed successfully',b.rfd05);refundNotify(b,'Refund disbursed successfully in simulation.');refundSaveApp(b);refundRender(id)},700)},700)}
  window.refundDownload=function(id,label){const app=refundGet(id);if(!app)return;const txt=`GST PORTAL TRAINING SIMULATOR\n${label}\n\nRFD-01 ARN: ${app.arn||'Draft'}\nCategory: ${app.category}\nFY: ${app.fy}\nTax Period: ${app.period}\nClaimed: ${app.claim}\nEligible: ${app.eligible}\nSanctioned: ${app.sanctioned||0}\nDisbursed: ${app.disbursed||0}\nStatus: ${app.status}\nBank Validation: ${app.bankStatus}\nRFD-02: ${app.rfd02||'—'}\nRFD-03: ${app.rfd03||'—'}\nRFD-04: ${app.rfd04||'—'}\nRFD-05: ${app.rfd05||'—'}\nRFD-06: ${app.rfd06||'—'}\n\nSIMULATED TRAINING DOCUMENT — NOT A GOVERNMENT DOCUMENT`;
    const blob=new Blob([txt],{type:'text/plain'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${label.replace(/[^A-Za-z0-9]+/g,'_')}_${app.arn||app.id}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
  window.refundStatus=function(){const st=refundRead();const rows=st.applications.map(a=>`<tr><td>${refundEsc(a.arn||a.id)}</td><td>${refundEsc(a.category)}</td><td>${refundEsc(a.period)}</td><td>${refundMoney(a.claim)}</td><td>${refundEsc(a.status)}</td><td><button class="gst-action secondary" onclick="refundTrack('${a.id}')">TRACK</button> <button class="gst-action secondary" onclick="refundRender('${a.id}')">OPEN</button></td></tr>`).join('')||'<tr><td colspan="6">No refund applications found.</td></tr>';feature('Refund Application Status','Services > Refunds > Track Application Status',`<div class="gst-alert info">Official GST tracking supports ARN or Filing Year after login. Refund stages and PFMS bank-validation statuses are simulated here.</div><div class="gst-form-grid"><div><label>ARN</label><input id="rfSearchArn" class="f-input" placeholder="Enter simulated ARN"></div><div><label>Filing Year</label><select id="rfSearchFY" class="f-select"><option>2026-27</option><option>2025-26</option></select></div><div><button class="gst-action" onclick="refundSearch()">SEARCH</button></div></div><table class="gst-table"><thead><tr><th>ARN</th><th>Category</th><th>Tax Period</th><th>Claimed</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>`)}
  window.refundSearch=function(){const q=(document.getElementById('rfSearchArn')?.value||'').trim().toUpperCase();const st=refundRead();const a=st.applications.find(x=>x.arn===q);if(!a){notify('No refund application found for the entered ARN.');return}refundTrack(a.id)}
  window.refundLedger=function(){const st=refundRead();const rows=st.exportLedger.map(x=>`<tr><td>${refundEsc(x.period)}</td><td>${refundEsc(x.type)}</td><td>${refundEsc(x.ref)}</td><td>${refundMoney(x.igst)}</td><td>${refundMoney(x.cess)}</td><td>${refundEsc(x.status)}</td></tr>`).join('')||'<tr><td colspan="6">No export-ledger transactions yet. Export entries can be generated by the simulator export workflow.</td></tr>';feature('Refund / Export Ledger','Services > Refunds > Export Ledger',`<div class="gst-alert info">The GST Portal provides an Export Ledger showing return-period debit/credit IGST and Cess amounts and supports CSV downloads. This simulator maintains a local training ledger only.</div><div class="gst-action-row"><button class="gst-action secondary" onclick="refundLedgerDownload('EXPORT LEDGER')">DOWNLOAD AS CSV</button><button class="gst-action secondary" onclick="refundLedgerDownload('EXPORT TRANSACTIONS')">DOWNLOAD TRANSACTION AS CSV</button></div><table class="gst-table"><thead><tr><th>Period</th><th>Type</th><th>Reference</th><th>IGST</th><th>Cess</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`)}
  window.refundLedgerDownload=function(label){const st=refundRead();const csv=['Period,Type,Reference,IGST,Cess,Status',...st.exportLedger.map(x=>[x.period,x.type,x.ref,x.igst,x.cess,x.status].join(','))].join('\n');const blob=new Blob([csv],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${label.replace(/[^A-Za-z0-9]+/g,'_')}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
  window.refundBankStatus=function(){const st=refundRead();feature('Bank Account Status','Services > Refunds',`<div class="gst-alert info">A verified bank account is required for refund processing. PFMS validation is simulated and no banking information is transmitted.</div><table class="gst-table"><thead><tr><th>Bank</th><th>Account</th><th>IFSC</th><th>Status</th></tr></thead><tbody>${st.bankAccounts.map(b=>`<tr><td>${refundEsc(b.bank)}</td><td>${refundEsc(b.account)}</td><td>${refundEsc(b.ifsc)}</td><td>${refundEsc(b.status)}</td></tr>`).join('')}</tbody></table>`)}
  window.refundOpenStatus=refundStatus;

  // Override service routes for the refund module while preserving the original portal shell.
  const __origOpenFeatureRefund=openFeature;
  openFeature=function(t){if(t==='refund-apply')return refundApply();if(t==='refund-status')return refundStatus();if(t==='refund-ledger')return refundLedger();if(t==='refund-bank')return refundBankStatus();return __origOpenFeatureRefund(t)};

})();

/* ===== FULL E-INVOICE / IRP TRAINING MODULE =====
   Added on top of the original GST Portal shell. No external connection.
   Current workflow references: IRP generation, validation, 30-day reporting,
   view/manage, JSON/CSV, QR/IRN verification, 24-hour cancellation, MFA simulation. */
(function(){
  const KEY='gstEInvoiceState_v3';
  const DEMO={
    enabled:true, mfaRegistered:false, login:false, status:'Not Started',
    invoices:[], lastBatch:null, filters:{}, audit:[]
  };
  function st(){ return gstRead(KEY, DEMO); }
  function save(x){ gstWrite(KEY,x); }
  function money(n){return gstMoney ? gstMoney(+n||0) : '₹'+(+n||0).toFixed(2)}
  function escv(v){return typeof esc==='function'?esc(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function addAudit(action,ref,oldS,newS){const x=st();x.audit.unshift({at:new Date().toISOString(),action,ref,oldStatus:oldS||'',newStatus:newS||''});x.audit=x.audit.slice(0,200);save(x)}
  function ref(prefix){return prefix+'-SIM-'+new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14)+'-'+Math.floor(1000+Math.random()*9000)}
  function hex64(){let out='';const chars='0123456789abcdef';for(let i=0;i<64;i++)out+=chars[Math.floor(Math.random()*chars.length)];return out}
  function nowISO(){return new Date().toISOString()}
  function daysBetween(a,b){return Math.floor((new Date(b)-new Date(a))/86400000)}
  function reportingDays(docDate){return Math.floor((new Date()-new Date(docDate))/86400000)}
  function currentTaxpayer(){return gstRead('gstTaxpayer',window.GST_DEMO||{gstin:'29ABCDE1234F1Z5',legalName:'DEMO TAXPAYER',tradeName:'DEMO ENTERPRISE'});}
  function currentGSTIN(){return currentTaxpayer().gstin||'29ABCDE1234F1Z5'}
  function validateGSTIN(g){return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(String(g||''))}
  function validDocNo(n){return /^[A-Za-z0-9\/-]{1,16}$/.test(String(n||'')) && !/^0+$/.test(String(n||''))}
  function validDate(d){return /^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(new Date(d).getTime())}
  function stateName(code){return ({29:'Karnataka',32:'Kerala',27:'Maharashtra',07:'Delhi',09:'Uttar Pradesh',33:'Tamil Nadu',36:'Telangana'})[code]||'State/UT'}
  function compute(inv){
    const taxable=+inv.taxable||0, rate=+inv.rate||0, total=taxable+(taxable*rate/100);
    let igst=0,cgst=0,sgst=0;
    const intra=inv.pos===inv.sellerState;
    if(intra){cgst=taxable*rate/200;sgst=cgst}else igst=taxable*rate/100;
    return {taxable,igst,cgst,sgst,cess:+inv.cess||0,total:+(total+(+inv.cess||0)).toFixed(2)};
  }
  function baseNav(title,crumb,body){feature(title,crumb,body);window.scrollTo(0,0)}
  function irpLogin(){
    const x=st();
    baseNav('e-Invoice — IRP Login','Services > e-Invoice',`
      <div class="gst-alert info"><b>Invoice Registration Portal (IRP) training access.</b> This is a simulated IRP session. No real GST credentials or OTPs are accepted.</div>
      <div class="gst-section-title">Login</div>
      <div class="gst-form-grid">
        <div><label>Username</label><input id="eiUser" class="f-input" value="demo.irp"></div>
        <div><label>Password</label><input id="eiPass" class="f-input" type="password" value="Demo@123"></div>
        <div><label>Captcha</label><input id="eiCap" class="f-input" placeholder="Enter captcha"></div>
      </div>
      <div class="gst-action-row"><button class="gst-action" onclick="eiLogin()">LOGIN</button><button class="gst-action secondary" onclick="openFeature('einvoice')">BACK</button></div>
      <div class="gst-note">Production IRP portals use their own authentication and MFA. This simulator uses demo-only credentials.</div>`);
  }
  window.eiLogin=function(){
    const x=st();x.login=true;
    if(!x.mfaRegistered){save(x);baseNav('e-Invoice — MFA Registration','IRP > Account > MFA',`<div class="gst-alert warning"><b>MFA registration required.</b> Complete the simulated mobile/email OTP setup before IRP access.</div><div class="gst-form-grid"><div><label>Demo mobile OTP</label><input id="eiMfa1" class="f-input" maxlength="6" value="123456"></div><div><label>Demo email OTP</label><input id="eiMfa2" class="f-input" maxlength="6" value="123456"></div></div><div class="gst-action-row"><button class="gst-action" onclick="eiMFA()">VERIFY MFA</button></div>`);}
    else {save(x);eiDashboard()}
  };
  window.eiMFA=function(){const a=document.getElementById('eiMfa1')?.value,b=document.getElementById('eiMfa2')?.value;if(a!=='123456'||b!=='123456'){notify('Invalid demo MFA OTP');return}const x=st();x.mfaRegistered=true;x.login=true;save(x);addAudit('MFA_REGISTER','IRP','Pending','Registered');eiDashboard()}
  function ensureLogin(){if(!st().login)return irpLogin();eiDashboard()}
  function eiDashboard(){
    const x=st(), inv=x.invoices||[], active=inv.filter(i=>i.status==='Active').length, cancelled=inv.filter(i=>i.status==='Cancelled').length;
    baseNav('e-Invoice — Dashboard','IRP > Dashboard',`
      <div class="gst-alert info"><b>TRAINING SIMULATOR — NOT CONNECTED TO GSTN/IRP.</b> IRNs, acknowledgements and QR values are simulated.</div>
      <div class="gst-dash-head"><h2>e-Invoice Dashboard</h2><div class="gst-dash-meta"><span>GSTIN: <b>${escv(currentGSTIN())}</b></span><span>IRP User: <b>demo.irp</b></span><span>MFA: <b>Enabled</b></span></div></div>
      <div class="gst-summary-grid"><div class="gst-summary"><div class="label">Active IRNs</div><div class="value">${active}</div></div><div class="gst-summary"><div class="label">Cancelled IRNs</div><div class="value">${cancelled}</div></div><div class="gst-summary"><div class="label">Total Documents</div><div class="value">${inv.length}</div></div><div class="gst-summary"><div class="label">Mode</div><div class="value">TRAINING</div></div></div>
      <div class="gst-section-title">Generate / Manage</div>
      <div class="feature-grid three">
        <div class="f-card"><h3>Generate e-Invoice</h3><p>Enter invoice, credit note or debit note details, validate, then generate a simulated IRN.</p><button class="gst-action" onclick="eiGenerate()">GENERATE</button></div>
        <div class="f-card"><h3>Bulk Operations</h3><p>Import CSV/JSON-style records locally, validate them and generate simulated IRNs.</p><button class="gst-action" onclick="eiBulk()">OPEN</button></div>
        <div class="f-card"><h3>View e-Invoices</h3><p>Manage active/cancelled records, print, download JSON/CSV and cancel eligible IRNs.</p><button class="gst-action" onclick="eiManage()">VIEW</button></div>
        <div class="f-card"><h3>Verify Invoice / QR</h3><p>Verify a simulated IRN/QR and display invoice status.</p><button class="gst-action" onclick="eiVerify()">VERIFY</button></div>
        <div class="f-card"><h3>Check IRN Status</h3><p>Search by IRN or document details.</p><button class="gst-action" onclick="eiStatus()">CHECK</button></div>
        <div class="f-card"><h3>Audit / Processing Status</h3><p>Review every validation, generation and cancellation event.</p><button class="gst-action" onclick="eiAudit()">OPEN</button></div>
      </div>
      <div class="gst-section-title">Current Production Rules represented in training</div>
      <ul class="gst-list"><li>AATO ₹10 Cr+ taxpayers are subject to the 30-day reporting restriction from 1-Apr-2025.</li><li>Active IRN cancellation is simulated only within 24 hours.</li><li>IRN generation requires successful validation and de-duplication.</li><li>2026 RSP-based TotItemVal validation relaxation is represented for eligible invoices dated on/after 01-Feb-2026.</li></ul>`);
  }
  window.eiGenerate=function(existing){
    const inv=existing||{docType:'INV',docNo:'INV-1001',docDate:new Date().toISOString().slice(0,10),sellerGSTIN:currentGSTIN(),sellerName:'DEMO TAXPAYER',buyerGSTIN:'29PQRSX5678L1Z5',buyerName:'DEMO BUYER',pos:'29',sellerState:'29',supplyType:'B2B',taxable:100000,rate:18,cess:0,status:'Draft'};
    baseNav('e-Invoice — Generate IRN','IRP > Generate > e-Invoice',`
      <div class="gst-alert info"><b>Step 1 — Enter / Import Invoice Data.</b> Source invoice data can be entered manually or imported. The IRP validates mandatory fields, lengths, tax values and duplicate documents before IRN generation.</div>
      <div class="gst-section-title">Document Details</div>
      <div class="gst-form-grid">
        <div><label>Document Type *</label><select id="eiType" class="f-select"><option value="INV" ${inv.docType==='INV'?'selected':''}>Tax Invoice</option><option value="CRN" ${inv.docType==='CRN'?'selected':''}>Credit Note</option><option value="DBN" ${inv.docType==='DBN'?'selected':''}>Debit Note</option></select></div>
        <div><label>Document Number *</label><input id="eiNo" class="f-input" value="${escv(inv.docNo)}"></div>
        <div><label>Document Date *</label><input id="eiDate" class="f-input" type="date" value="${escv(inv.docDate)}"></div>
        <div><label>Supply Type *</label><select id="eiSupply" class="f-select"><option>B2B</option><option>SEZWP</option><option>SEZWOP</option><option>EXPWP</option><option>EXPWOP</option><option>DEXP</option></select></div>
        <div><label>Reverse Charge</label><select id="eiRC" class="f-select"><option value="N">No</option><option value="Y">Yes</option></select></div>
        <div><label>Place of Supply *</label><input id="eiPOS" class="f-input" maxlength="2" value="${escv(inv.pos)}"></div>
      </div>
      <div class="gst-section-title">Supplier Details</div>
      <div class="gst-form-grid"><div><label>Supplier GSTIN *</label><input id="eiSeller" class="f-input" value="${escv(inv.sellerGSTIN)}"></div><div><label>Supplier Legal Name *</label><input id="eiSellerName" class="f-input" value="${escv(inv.sellerName)}"></div><div><label>Supplier Address *</label><input id="eiSellerAddr" class="f-input" value="DEMO ADDRESS, INDIA"></div><div><label>Supplier Pincode *</label><input id="eiSellerPin" class="f-input" maxlength="6" value="689101"></div></div>
      <div class="gst-section-title">Buyer Details</div>
      <div class="gst-form-grid"><div><label>Buyer GSTIN *</label><input id="eiBuyer" class="f-input" value="${escv(inv.buyerGSTIN)}"></div><div><label>Buyer Legal Name *</label><input id="eiBuyerName" class="f-input" value="${escv(inv.buyerName)}"></div><div><label>Buyer Address *</label><input id="eiBuyerAddr" class="f-input" value="DEMO BUYER ADDRESS, INDIA"></div><div><label>Buyer Pincode *</label><input id="eiBuyerPin" class="f-input" maxlength="6" value="689102"></div></div>
      <div class="gst-section-title">Item Details</div>
      <table class="gst-table"><thead><tr><th>Sl.</th><th>HSN/SAC *</th><th>Description *</th><th>Qty *</th><th>UQC</th><th>Taxable Value *</th><th>Rate % *</th><th>IGST</th><th>CGST</th><th>SGST</th><th>Cess</th></tr></thead><tbody><tr><td>1</td><td><input id="eiHSN" class="f-input" value="998599"></td><td><input id="eiDesc" class="f-input" value="Demo taxable supply"></td><td><input id="eiQty" class="f-input" type="number" min="0.001" value="1"></td><td><input id="eiUQC" class="f-input" value="NOS"></td><td><input id="eiTax" class="f-input" type="number" min="0" step="0.01" value="${inv.taxable}"></td><td><select id="eiRate" class="f-select"><option>0</option><option>5</option><option selected>18</option><option>40</option></select></td><td id="eiIGST">₹0.00</td><td id="eiCGST">₹9,000.00</td><td id="eiSGST">₹9,000.00</td><td><input id="eiCess" class="f-input" type="number" value="0"></td></tr></tbody></table>
      <div id="eiCalc" class="gst-alert info">Tax will be calculated during validation.</div>
      <div class="gst-section-title">Reference / Additional Details</div>
      <div class="gst-form-grid"><div><label>IRN Reference (system generated)</label><input class="f-input" value="Generated by IRP" disabled></div><div><label>Reporting Eligibility</label><select id="eiAATO" class="f-select"><option value="10">AATO ₹10 Cr or above</option><option value="below">Below threshold / not applicable</option></select></div><div><label>Remarks</label><input id="eiRemarks" class="f-input" value=""></div></div>
      <div class="gst-action-row"><button class="gst-action" onclick="eiValidateAndGenerate()">VALIDATE DATA</button><button class="gst-action secondary" onclick="eiDashboard()">BACK</button></div>
      <div class="gst-note">For AATO ₹10 Cr+ the simulator applies the current 30-day reporting restriction. Actual applicability depends on the taxpayer's legal status and current notifications.</div>`);
    ['eiTax','eiRate','eiPOS'].forEach(id=>document.getElementById(id)?.addEventListener('input',eiRecalc));
    eiRecalc();
  }
  window.eiRecalc=function(){const tax=+(document.getElementById('eiTax')?.value||0),rate=+(document.getElementById('eiRate')?.value||0),pos=document.getElementById('eiPOS')?.value||'',seller=currentGSTIN().slice(0,2),x=tax*rate/100,intra=pos===seller;const ig= document.getElementById('eiIGST'),cg=document.getElementById('eiCGST'),sg=document.getElementById('eiSGST');if(ig)ig.textContent=money(intra?0:x);if(cg)cg.textContent=money(intra?x/2:0);if(sg)sg.textContent=money(intra?x/2:0);const c=+(document.getElementById('eiCess')?.value||0),t=tax+x+c;const b=document.getElementById('eiCalc');if(b)b.innerHTML=`Taxable: <b>${money(tax)}</b> &nbsp; Total Tax: <b>${money(x+c)}</b> &nbsp; Invoice Value: <b>${money(t)}</b>`}
  window.eiValidateAndGenerate=function(){
    const fields={docType:document.getElementById('eiType')?.value,docNo:document.getElementById('eiNo')?.value.trim(),docDate:document.getElementById('eiDate')?.value,supplyType:document.getElementById('eiSupply')?.value,rc:document.getElementById('eiRC')?.value,pos:document.getElementById('eiPOS')?.value.trim(),sellerGSTIN:document.getElementById('eiSeller')?.value.trim().toUpperCase(),sellerName:document.getElementById('eiSellerName')?.value.trim(),buyerGSTIN:document.getElementById('eiBuyer')?.value.trim().toUpperCase(),buyerName:document.getElementById('eiBuyerName')?.value.trim(),taxable:+(document.getElementById('eiTax')?.value||0),rate:+(document.getElementById('eiRate')?.value||0),cess:+(document.getElementById('eiCess')?.value||0),hsn:document.getElementById('eiHSN')?.value.trim(),qty:+(document.getElementById('eiQty')?.value||0),uqc:document.getElementById('eiUQC')?.value.trim(),aato:document.getElementById('eiAATO')?.value};
    const errors=[];if(!fields.docType)errors.push('Document Type is mandatory.');if(!validDocNo(fields.docNo))errors.push('Document Number is invalid. Use a valid invoice/credit/debit note number.');if(!validDate(fields.docDate))errors.push('Document Date is mandatory and must be valid.');if(!validateGSTIN(fields.sellerGSTIN))errors.push('Supplier GSTIN format is invalid.');if(fields.sellerGSTIN!==currentGSTIN().toUpperCase())errors.push('Supplier GSTIN must match the logged-in demo taxpayer for this workflow.');if(!validateGSTIN(fields.buyerGSTIN))errors.push('Buyer GSTIN format is invalid for this B2B training record.');if(!fields.sellerName||!fields.buyerName)errors.push('Supplier and Buyer legal names are mandatory.');if(!/^\d{2}$/.test(fields.pos))errors.push('Place of Supply must be a valid two-digit state code.');if(!fields.hsn)errors.push('HSN/SAC is mandatory.');if(fields.qty<=0)errors.push('Quantity must be greater than zero.');if(fields.taxable<=0)errors.push('Taxable value must be greater than zero.');
    const x=st();const duplicate=(x.invoices||[]).some(i=>i.sellerGSTIN===fields.sellerGSTIN&&i.docNo===fields.docNo&&i.status!=='Cancelled');if(duplicate)errors.push('Duplicate document: an active IRN already exists for this supplier GSTIN and document number.');
    const age=reportingDays(fields.docDate);if(fields.aato==='10'&&age>30)errors.push('IRN generation restricted: AATO ₹10 Cr+ invoice is older than 30 days from document date.');
    const calc=compute({taxable:fields.taxable,rate:fields.rate,cess:fields.cess,pos:fields.pos,sellerState:fields.sellerGSTIN.slice(0,2)});
    const rspEligible=fields.docDate>='2026-02-01' && ['9983','9984','9985'].some(p=>fields.hsn.startsWith(p));
    if(errors.length){baseNav('e-Invoice — Validation Errors','IRP > Generate > Validate',`<div class="gst-alert error"><b>Validation failed. No IRN generated.</b><ul>${errors.map(e=>`<li>${escv(e)}</li>`).join('')}</ul></div><div class="gst-note">Correct the source data and run validation again. This follows the IRP pattern: errors must be cleared before Generate IRN.</div><button class="gst-action secondary" onclick="eiGenerate()">BACK TO DATA</button>`);return}
    const irn=hex64(), ack=String(Date.now()).slice(-15), ackDate=nowISO(), qr='SIM-QR|IRN:'+irn+'|GSTIN:'+fields.sellerGSTIN+'|DOC:'+fields.docNo+'|DATE:'+fields.docDate;const record={...fields,...calc,irn,ack,ackDate,generatedAt:ackDate,status:'Active',signedInvoice:'SIMULATED-SIGNED-INVOICE',signedQR:qr,reportingDays:Math.max(0,age),rspValidationRelaxed:rspEligible,createdAt:ackDate};x.invoices.unshift(record);x.status='Generated';x.lastBatch=[irn];save(x);
    // Feed the simulated e-invoice into the existing return data layer so downstream training views can consume it.
    const returnInvoices=gstRead('gstInvoices',[]); const yr=+fields.docDate.slice(0,4),mo=+fields.docDate.slice(5,7),fy=(mo>=4?yr+'-'+String(yr+1).slice(-2):String(yr-1)+'-'+String(yr).slice(-2)); returnInvoices.unshift({fy,period:fields.docDate.slice(0,7),invoiceNo:fields.docNo,invoiceDate:fields.docDate,recipientGSTIN:fields.buyerGSTIN,taxableValue:fields.taxable,igst:calc.igst,cgst:calc.cgst,sgst:calc.sgst,cess:calc.cess,total:calc.total,source:'E-INVOICE (SIMULATED)',irn:irn,status:'Active'}); gstWrite('gstInvoices',returnInvoices);
    addAudit('GENERATE_IRN',irn,'Validated','Active');
    baseNav('e-Invoice — IRN Generated','IRP > Generate > Response',`<div class="gst-alert success"><b>IRN generated successfully (SIMULATED).</b> The invoice passed validation and de-duplication.</div><table class="gst-table"><tbody><tr><th>IRN</th><td style="word-break:break-all">${irn}</td></tr><tr><th>Acknowledgement Number</th><td>${ack}</td></tr><tr><th>Acknowledgement Date</th><td>${ackDate}</td></tr><tr><th>Status</th><td><b>Active</b></td></tr><tr><th>Signed QR</th><td style="word-break:break-all">${escv(qr)}</td></tr><tr><th>Invoice Value</th><td>${money(calc.total)}</td></tr><tr><th>2026 RSP validation relaxation</th><td>${rspEligible?'Applicable to this training record':'Not applicable'}</td></tr></tbody></table><div class="gst-action-row"><button class="gst-action" onclick="eiPrint('${irn}')">PRINT IRN / INVOICE</button><button class="gst-action secondary" onclick="eiManage()">VIEW E-INVOICES</button><button class="gst-action secondary" onclick="eiDashboard()">DASHBOARD</button></div>`);
  }
  window.eiBulk=function(){baseNav('e-Invoice — Bulk Operations','IRP > Generate > Bulk Operations',`<div class="gst-alert info"><b>Bulk training workflow.</b> Import CSV/JSON locally, validate every record, correct errors, then Generate IRN. No file is transmitted.</div><div class="gst-section-title">Import Data</div><input id="eiFile" class="f-input" type="file" accept=".csv,.json"><div class="gst-action-row"><button class="gst-action" onclick="eiImport()">IMPORT & VALIDATE</button><button class="gst-action secondary" onclick="eiDashboard()">BACK</button></div><div id="eiBulkResult"></div><div class="gst-note">The IRP supports source-file/import workflows and JSON generation/upload. This standalone simulator parses CSV/JSON locally.</div>`)};
  window.eiImport=function(){const f=document.getElementById('eiFile')?.files?.[0],out=document.getElementById('eiBulkResult');if(!f){out.innerHTML='<div class="gst-alert error">Select a CSV or JSON file first.</div>';return}const r=new FileReader();r.onload=()=>{try{let data=f.name.toLowerCase().endsWith('.json')?JSON.parse(r.result):String(r.result).split(/\r?\n/).filter(Boolean).map((line,i)=>({docNo:line.split(',')[0]||'BULK-'+(i+1),docDate:line.split(',')[1]||new Date().toISOString().slice(0,10),sellerGSTIN:currentGSTIN(),buyerGSTIN:'29PQRSX5678L1Z5',taxable:+line.split(',')[2]||1000,rate:+line.split(',')[3]||18,docType:'INV',pos:'29',sellerName:'DEMO TAXPAYER',buyerName:'DEMO BUYER',hsn:'998599',qty:1,cess:0}));if(!Array.isArray(data))data=[data];out.innerHTML=`<div class="gst-alert success">Imported <b>${data.length}</b> record(s). Review the source data, then open each record for final validation/IRN generation.</div><table class="gst-table"><thead><tr><th>Document</th><th>Date</th><th>GSTIN</th><th>Taxable</th><th>Rate</th><th>Action</th></tr></thead><tbody>${data.slice(0,100).map((d,i)=>`<tr><td>${escv(d.docNo)}</td><td>${escv(d.docDate)}</td><td>${escv(d.sellerGSTIN||'')}</td><td>${money(d.taxable)}</td><td>${escv(d.rate)}%</td><td><button class="gst-action" onclick='eiGenerate(${JSON.stringify(d).replace(/'/g,"&#39;")})'>OPEN</button></td></tr>`).join('')}</tbody></table>`}catch(e){out.innerHTML='<div class="gst-alert error">Import failed: invalid CSV/JSON structure.</div>'}};r.readAsText(f)};
  function filteredInvoices(){return st().invoices||[]}
  window.eiManage=function(){const inv=filteredInvoices();const rows=inv.length?inv.map((i,idx)=>`<tr><td><input type="checkbox" class="eiSel" value="${idx}"></td><td>${escv(i.docType)}</td><td>${escv(i.docNo)}</td><td>${escv(i.docDate)}</td><td>${escv(i.supplyType)}</td><td>${money(i.total)}</td><td>${escv(i.irn).slice(0,18)}…</td><td>${escv(i.ack)}</td><td><b>${escv(i.status)}</b></td><td><button class="gst-action" onclick="eiView('${escv(i.irn)}')">VIEW</button></td></tr>`).join(''):'<tr><td colspan="10">No e-invoices generated.</td></tr>';baseNav('e-Invoice — View / Manage e-Invoices','IRP > Manage > View Invoices',`<div class="gst-alert info">Default IRP views focus on recently acknowledged records. The simulator retains its complete local training history.</div><div class="gst-form-grid"><div><label>Search IRN / Document Number</label><input id="eiSearch" class="f-input" oninput="eiFilterRows()"></div><div><label>Status</label><select id="eiStatusFilter" class="f-select" onchange="eiFilterRows()"><option>All</option><option>Active</option><option>Cancelled</option></select></div></div><table class="gst-table" id="eiManageTable"><thead><tr><th>Select</th><th>Type</th><th>Document No.</th><th>Date</th><th>Supply</th><th>Value</th><th>IRN</th><th>Ack No.</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table><div class="gst-action-row"><button class="gst-action" onclick="eiCancelSelected()">CANCEL IRN</button><button class="gst-action secondary" onclick="eiExportCSV()">DOWNLOAD CSV</button><button class="gst-action secondary" onclick="eiExportJSON()">DOWNLOAD JSON</button><button class="gst-action secondary" onclick="eiPrintSelected()">PRINT</button><button class="gst-action secondary" onclick="eiDashboard()">BACK</button></div><div class="gst-note">IRN cancellation is simulated only for active IRNs within 24 hours. Reason and remark are mandatory. If an E-Way Bill is already linked, the simulator blocks IRN cancellation until the EWB is cancelled where applicable.</div>`)};
  window.eiFilterRows=function(){const q=(document.getElementById('eiSearch')?.value||'').toLowerCase(),f=document.getElementById('eiStatusFilter')?.value||'All';document.querySelectorAll('#eiManageTable tbody tr').forEach(tr=>{const txt=tr.innerText.toLowerCase();tr.style.display=(!q||txt.includes(q))&&(f==='All'||txt.includes(f.toLowerCase()))?'':'none'})}
  window.eiView=function(irn){const i=filteredInvoices().find(x=>x.irn===irn);if(!i){notify('IRN not found');return}baseNav('e-Invoice — Invoice Details','IRP > Manage > View Invoice',`<table class="gst-table"><tbody><tr><th>Document</th><td>${escv(i.docType)} / ${escv(i.docNo)} / ${escv(i.docDate)}</td></tr><tr><th>Supplier</th><td>${escv(i.sellerName)} (${escv(i.sellerGSTIN)})</td></tr><tr><th>Buyer</th><td>${escv(i.buyerName)} (${escv(i.buyerGSTIN)})</td></tr><tr><th>Place of Supply</th><td>${escv(i.pos)}</td></tr><tr><th>Taxable Value</th><td>${money(i.taxable)}</td></tr><tr><th>IGST</th><td>${money(i.igst)}</td></tr><tr><th>CGST</th><td>${money(i.cgst)}</td></tr><tr><th>SGST</th><td>${money(i.sgst)}</td></tr><tr><th>Cess</th><td>${money(i.cess)}</td></tr><tr><th>Invoice Value</th><td>${money(i.total)}</td></tr><tr><th>IRN</th><td style="word-break:break-all">${escv(i.irn)}</td></tr><tr><th>Acknowledgement</th><td>${escv(i.ack)} / ${escv(i.ackDate)}</td></tr><tr><th>Status</th><td>${escv(i.status)}</td></tr><tr><th>Signed QR</th><td style="word-break:break-all">${escv(i.signedQR)}</td></tr></tbody></table><div class="gst-action-row"><button class="gst-action" onclick="eiPrint('${escv(i.irn)}')">PRINT</button><button class="gst-action secondary" onclick="eiDashboard()">BACK</button></div>`)};
  window.eiCancelSelected=function(){const ids=[...document.querySelectorAll('.eiSel:checked')].map(e=>+e.value);if(!ids.length){notify('Select an active IRN');return}const x=st(),records=ids.map(n=>x.invoices[n]).filter(Boolean);if(records.some(i=>i.status!=='Active')){notify('Only active IRNs can be cancelled');return}const bad=records.find(i=>reportingDays(i.generatedAt)>0&&((new Date()-new Date(i.generatedAt))/3600000)>24);if(bad){baseNav('e-Invoice — Cancellation Error','IRP > Manage > Cancel IRN',`<div class="gst-alert error"><b>Cancellation not permitted.</b> Only active IRNs within 24 hours are eligible.</div><button class="gst-action secondary" onclick="eiManage()">BACK</button>`);return}baseNav('e-Invoice — Cancel IRN','IRP > Manage > Cancel IRN',`<div class="gst-alert warning"><b>Cancellation confirmation</b> — selected IRN(s) will be cancelled completely. Partial cancellation is not permitted.</div><div class="gst-form-grid"><div><label>Cancellation Reason *</label><select id="eiCancelReason" class="f-select"><option>Duplicate</option><option>Data Entry Mistake</option><option>Order Cancelled</option><option>Other</option></select></div><div><label>Remark *</label><input id="eiCancelRemark" class="f-input" placeholder="Enter mandatory remark"></div></div><div class="gst-action-row"><button class="gst-action" onclick='eiConfirmCancel(${JSON.stringify(ids)})'>SUBMIT CANCELLATION</button><button class="gst-action secondary" onclick="eiManage()">BACK</button></div>`)};
  window.eiConfirmCancel=function(ids){const reason=document.getElementById('eiCancelReason')?.value,remark=document.getElementById('eiCancelRemark')?.value.trim();if(!remark){notify('Remark is mandatory');return}const x=st();ids.forEach(n=>{const i=x.invoices[n];if(i){const old=i.status;i.status='Cancelled';i.cancelledAt=nowISO();i.cancelReason=reason;i.cancelRemark=remark;addAudit('CANCEL_IRN',i.irn,old,'Cancelled')}});save(x);eiManage()}
  window.eiVerify=function(){baseNav('Verify Invoice / QR Code','e-Invoice > Verify Invoice / QR Code',`<div class="gst-alert info">Enter the simulated IRN or document number. Real IRP verification is not queried.</div><div class="gst-form-grid"><div><label>IRN</label><input id="eiVerifyIRN" class="f-input"></div><div><label>Document Number</label><input id="eiVerifyDoc" class="f-input"></div></div><div class="gst-action-row"><button class="gst-action" onclick="eiDoVerify()">VERIFY</button><button class="gst-action secondary" onclick="eiDashboard()">BACK</button></div><div id="eiVerifyOut"></div>`)};
  window.eiDoVerify=function(){const q=(document.getElementById('eiVerifyIRN')?.value||'').trim(),d=(document.getElementById('eiVerifyDoc')?.value||'').trim(),i=filteredInvoices().find(x=>(q&&x.irn===q)||(d&&x.docNo===d));const o=document.getElementById('eiVerifyOut');if(!i){o.innerHTML='<div class="gst-alert error">No matching simulated e-invoice found.</div>';return}o.innerHTML=`<div class="gst-alert success"><b>Verified.</b> Status: ${escv(i.status)}</div><table class="gst-table"><tbody><tr><th>IRN</th><td>${escv(i.irn)}</td></tr><tr><th>Document</th><td>${escv(i.docNo)}</td></tr><tr><th>Supplier GSTIN</th><td>${escv(i.sellerGSTIN)}</td></tr><tr><th>Invoice Value</th><td>${money(i.total)}</td></tr><tr><th>Acknowledgement</th><td>${escv(i.ack)}</td></tr><tr><th>Signed QR</th><td>${escv(i.signedQR)}</td></tr></tbody></table>`}
  window.eiStatus=function(){baseNav('Check IRN Status','e-Invoice > Check IRN Status',`<div class="gst-form-grid"><div><label>IRN</label><input id="eiStatusIRN" class="f-input"></div><div><label>Document Number</label><input id="eiStatusDoc" class="f-input"></div></div><div class="gst-action-row"><button class="gst-action" onclick="eiDoStatus()">CHECK STATUS</button><button class="gst-action secondary" onclick="eiDashboard()">BACK</button></div><div id="eiStatusOut"></div>`)};
  window.eiDoStatus=function(){const q=(document.getElementById('eiStatusIRN')?.value||'').trim(),d=(document.getElementById('eiStatusDoc')?.value||'').trim(),i=filteredInvoices().find(x=>(q&&x.irn===q)||(d&&x.docNo===d));const o=document.getElementById('eiStatusOut');o.innerHTML=i?`<div class="gst-alert success">IRN status: <b>${escv(i.status)}</b></div>`:'<div class="gst-alert error">IRN/document not found in simulator.</div>'}
  window.eiAudit=function(){const x=st();baseNav('e-Invoice — Audit / Processing Status','e-Invoice > Audit',`<table class="gst-table"><thead><tr><th>Timestamp</th><th>Action</th><th>Reference</th><th>Old</th><th>New</th></tr></thead><tbody>${(x.audit||[]).map(a=>`<tr><td>${escv(a.at)}</td><td>${escv(a.action)}</td><td style="word-break:break-all">${escv(a.ref)}</td><td>${escv(a.oldStatus)}</td><td>${escv(a.newStatus)}</td></tr>`).join('')||'<tr><td colspan="5">No audit events.</td></tr>'}</tbody></table><button class="gst-action secondary" onclick="eiDashboard()">BACK</button>`)};
  window.eiExportCSV=function(){const rows=filteredInvoices();const csv=['DocType,DocNo,DocDate,SupplierGSTIN,BuyerGSTIN,Taxable,IGST,CGST,SGST,Cess,Total,IRN,Ack,Status',...rows.map(i=>[i.docType,i.docNo,i.docDate,i.sellerGSTIN,i.buyerGSTIN,i.taxable,i.igst,i.cgst,i.sgst,i.cess,i.total,i.irn,i.ack,i.status].map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='simulated-einvoice-register.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
  window.eiExportJSON=function(){const blob=new Blob([JSON.stringify(filteredInvoices(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='simulated-einvoice-register.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
  window.eiPrint=function(irn){const i=filteredInvoices().find(x=>x.irn===irn);if(!i)return;const w=window.open('','_blank');if(!w){notify('Popup blocked. Allow popups to print the training document.');return}w.document.write(`<html><head><title>Simulated e-Invoice</title><style>body{font-family:Arial;padding:30px;color:#123}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:8px;text-align:left}.water{font-weight:bold;text-align:center;border:2px solid #c00;padding:10px;margin-bottom:15px;color:#900}</style></head><body><div class="water">SIMULATED TRAINING DOCUMENT — NOT A GOVERNMENT DOCUMENT</div><h2>e-Invoice / IRN</h2><table>${[['Document',i.docType+' / '+i.docNo],['Date',i.docDate],['Supplier',i.sellerName+' / '+i.sellerGSTIN],['Buyer',i.buyerName+' / '+i.buyerGSTIN],['Taxable',money(i.taxable)],['IGST',money(i.igst)],['CGST',money(i.cgst)],['SGST',money(i.sgst)],['Cess',money(i.cess)],['Total',money(i.total)],['IRN',i.irn],['Ack No.',i.ack],['Ack Date',i.ackDate],['Status',i.status],['Signed QR',i.signedQR]].map(r=>'<tr><th>'+escv(r[0])+'</th><td>'+escv(r[1])+'</td></tr>').join('')}</table><script>window.onload=()=>window.print()<\/script>







</body></html>`);w.document.close()}
  window.eiPrintSelected=function(){const ids=[...document.querySelectorAll('.eiSel:checked')].map(e=>+e.value);const x=st();const i=x.invoices[ids[0]];if(i)eiPrint(i.irn);else notify('Select an invoice to print')}
  const origOpenFeatureEI=window.openFeature;
  window.openFeature=function(t){
    if(t==='einvoice')return ensureLogin();
    if(t==='verify-invoice')return eiVerify();
    if(t==='irn')return eiStatus();
    if(t==='einvoice-help')return baseNav('e-Invoice Help','e-Invoice > Help',`<div class="gst-alert info"><b>Training help.</b> The simulator covers source-data entry/import → validation → duplicate check → Generate IRN → acknowledgement/IRN/signed QR → Manage/View → Print/JSON/CSV → 24-hour cancellation → verification/status.</div><button class="gst-action secondary" onclick="eiDashboard()">BACK</button>`);
    return origOpenFeatureEI(t);
  };
})();



/* ===== Extracted script block ===== */


/* ===== FULL E-WAY BILL TRAINING MODULE — CURRENT 2026 WORKFLOW ===== */
(function(){
  const KEY='GST_SIM_EWB_FULL_V2';
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{"ewbs":[],"partA":[],"cewb":[],"audit":[]}')}catch(e){return {ewbs:[],partA:[],cewb:[],audit:[]}}};
  const save=x=>localStorage.setItem(KEY,JSON.stringify(x));
  const esc=x=>typeof escv==='function'?escv(x):String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money2=x=>'₹'+Number(x||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const now=()=>new Date().toISOString();
  const ref=(p,n=12)=>p+'-'+Math.floor(Math.random()*10**n).toString().padStart(n,'0');
  const stateCodes={Kerala:'32',Karnataka:'29',TamilNadu:'33',Maharashtra:'27',Delhi:'07',Gujarat:'24',Rajasthan:'08',Telangana:'36',AndhraPradesh:'37'};
  const audit=(x,action,refno,oldS='',newS='')=>{x.audit.push({at:now(),action,ref:refno,oldStatus:oldS,newStatus:newS});save(x)};
  function vehicleValid(v){return /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}$/i.test(String(v||'').replace(/[ -]/g,''))}
  function docDateValid(d){if(!d)return false;const dt=new Date(d+'T00:00:00'),today=new Date();const days=(today-dt)/86400000;return days>=0&&days<=180}
  function renderTable(rows){return rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join(''):'<tr><td colspan="10">No records found.</td></tr>'}
  function dash(){
    const x=load();
    feature('E-Way Bill System','Services > e-Way Bill System',`
      <div class="gst-alert info"><b>TRAINING SIMULATOR</b> — This e-Way Bill module is offline and not connected to the Government E-Way Bill system.</div>
      <div class="gst-summary-grid">
        <div class="gst-stat"><span>Active EWBs</span><b>${x.ewbs.filter(e=>e.status==='Active').length}</b></div>
        <div class="gst-stat"><span>Part-A Slips</span><b>${x.partA.filter(e=>e.status==='Part-A').length}</b></div>
        <div class="gst-stat"><span>Consolidated EWBs</span><b>${x.cewb.length}</b></div>
        <div class="gst-stat"><span>Closed</span><b>${x.ewbs.filter(e=>e.status==='Closed').length}</b></div>
      </div>
      <div class="gst-action-row">
        <button class="gst-action" onclick="ewbGenerate()">GENERATE E-WAY BILL</button>
        <button class="gst-action" onclick="ewbPartAList()">PART-A SLIPS</button>
        <button class="gst-action" onclick="ewbHistory()">E-WAY BILL HISTORY</button>
        <button class="gst-action secondary" onclick="ewbDashboard()">REFRESH</button>
      </div>
      <div class="f-card"><h3>Recent E-Way Bills</h3><div style="overflow:auto"><table class="gst-table"><thead><tr><th>EWB No.</th><th>Document</th><th>From</th><th>To</th><th>Mode</th><th>Status</th><th>Valid Upto</th><th>Action</th></tr></thead><tbody>${renderTable(x.ewbs.slice(-8).reverse().map(e=>[e.no,e.docNo,e.fromPlace,e.toPlace,e.mode,e.status,e.validUpto,`<button class="gst-action secondary" onclick="ewbView('${e.no}')">VIEW</button>`]))}</tbody></table></div></div>`);
  }
  window.ewbDashboard=dash;
  function ewbGenerate(){
    feature('Generate E-Way Bill','e-Way Bill System > Generate',`
      <div class="gst-alert info"><b>Step 1 of 2 — Part-A.</b> Enter the document and movement details. For road movement, Part-B/vehicle details are required to generate the E-Way Bill. Without transport details the system creates a Part-A Slip.</div>
      <div class="feature-grid"><div class="f-card"><h3>Transaction Details</h3>
        <label class="f-label">Supply Type *</label><select class="f-select" id="ewSupply"><option value="Outward">Outward</option><option value="Inward">Inward</option></select>
        <label class="f-label">Sub Supply Type *</label><select class="f-select" id="ewSub"><option>Supply</option><option>Export</option><option>Import</option><option>Job Work</option><option>SKD/CKD</option><option>Recipient Not Known</option><option>For Own Use</option><option>Exhibition or Fairs</option><option>Line Sales</option><option>Sales Return</option><option>Others</option></select>
        <label class="f-label">Document Type *</label><select class="f-select" id="ewDocType"><option>Tax Invoice</option><option>Bill of Supply</option><option>Delivery Challan</option><option>Bill of Entry</option><option>Credit Note</option></select>
        <label class="f-label">Document Number *</label><input class="f-input" id="ewDocNo" maxlength="16">
        <label class="f-label">Document Date *</label><input class="f-input" id="ewDocDate" type="date">
      </div><div class="f-card"><h3>Value & Parties</h3>
        <label class="f-label">Taxable Value *</label><input class="f-input" id="ewTaxable" type="number" min="0" step="0.01">
        <label class="f-label">Total Invoice Value *</label><input class="f-input" id="ewTotal" type="number" min="0" step="0.01">
        <label class="f-label">HSN Code *</label><input class="f-input" id="ewHsn" placeholder="e.g. 6109">
        <label class="f-label">Quantity *</label><input class="f-input" id="ewQty" type="number" min="0.01" step="0.01">
        <label class="f-label">Unit *</label><select class="f-select" id="ewUqc"><option>NOS</option><option>KGS</option><option>PCS</option><option>MTR</option><option>LTR</option><option>BOX</option></select>
      </div></div>
      <div class="f-card"><h3>Bill From / Bill To</h3><div class="gst-form-grid">
        <div><label>Bill From GSTIN *</label><input class="f-input" id="ewFromGST" value="32ABCDE1234F1Z5"></div>
        <div><label>Bill From State *</label><select class="f-select" id="ewFromState"><option>Kerala</option><option>Karnataka</option><option>TamilNadu</option><option>Maharashtra</option></select></div>
        <div><label>Bill From Place *</label><input class="f-input" id="ewFromPlace" value="Thiruvalla"></div>
        <div><label>Bill From PIN *</label><input class="f-input" id="ewFromPin" value="689101" maxlength="6"></div>
        <div><label>Bill To GSTIN *</label><input class="f-input" id="ewToGST" value="29ABCDE1234F1Z5"></div>
        <div><label>Bill To State *</label><select class="f-select" id="ewToState"><option>Karnataka</option><option>Kerala</option><option>TamilNadu</option><option>Maharashtra</option></select></div>
        <div><label>Bill To Place *</label><input class="f-input" id="ewToPlace" value="Bengaluru"></div>
        <div><label>Bill To PIN *</label><input class="f-input" id="ewToPin" value="560001" maxlength="6"></div>
      </div></div>
      <div class="f-card"><h3>Bill-To / Ship-To (2026)</h3><div class="gst-form-grid">
        <div><label>Transaction</label><select class="f-select" id="ewShipMode" onchange="document.getElementById('ewShipBox').style.display=this.value==='BillToShipTo'?'grid':'none'"><option value="Regular">Regular</option><option value="BillToShipTo">Bill To - Ship To</option></select></div>
        <div id="ewShipBox" style="display:none"><label>Ship-To GSTIN *</label><input class="f-input" id="ewShipGST"></div>
        <div id="ewShipPlaceBox" style="display:none"><label>Ship-To Place</label><input class="f-input" id="ewShipPlace"></div>
        <div id="ewShipPinBox" style="display:none"><label>Ship-To PIN</label><input class="f-input" id="ewShipPin" maxlength="6"></div>
      </div></div>
      <div class="f-card"><h3>Part-B / Transportation</h3><div class="gst-form-grid">
        <div><label>Mode of Transport *</label><select class="f-select" id="ewMode"><option>Road</option><option>Rail</option><option>Air</option><option>Ship</option><option>Road-Cum-Ship</option></select></div>
        <div><label>Transporter ID</label><input class="f-input" id="ewTransGST"></div>
        <div><label>Transport Document No.</label><input class="f-input" id="ewTransDoc"></div>
        <div><label>Transport Document Date</label><input class="f-input" id="ewTransDate" type="date"></div>
        <div><label>Vehicle Number (Road)</label><input class="f-input" id="ewVehicle" placeholder="KL01AB1234"></div>
        <div><label>Vehicle Type</label><select class="f-select" id="ewVehicleType"><option>Regular</option><option>Over Dimensional Cargo</option></select></div>
        <div><label>Approx. Distance (KM) *</label><input class="f-input" id="ewDistance" type="number" min="1"></div>
      </div></div>
      <div class="gst-action-row"><button class="gst-action" onclick="ewbValidatePartA()">VALIDATE</button><button class="gst-action secondary" onclick="ewbDashboard()">CANCEL</button></div><div id="ewGenOut"></div>`);
  }
  window.ewbGenerate=ewbGenerate;
  function gstinOK(g){return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(g||'')}
  function ewbValidatePartA(){
    const ids=['ewDocNo','ewDocDate','ewTaxable','ewTotal','ewHsn','ewQty','ewFromGST','ewToGST','ewFromPin','ewToPin','ewDistance'];
    const vals=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)?.value.trim()]));
    const errs=[];
    if(!vals.ewDocNo)errs.push('Document number is mandatory.');
    if(!docDateValid(vals.ewDocDate))errs.push('Document date must be valid and within the current 180-day E-Way Bill generation window.');
    if(!gstinOK(vals.ewFromGST)||!gstinOK(vals.ewToGST))errs.push('Enter valid GSTINs for Bill From and Bill To.');
    if(vals.ewFromGST===vals.ewToGST)errs.push('Bill From and Bill To GSTIN cannot be the same for this training transaction.');
    if(Number(vals.ewTotal)<=0||Number(vals.ewTaxable)<0)errs.push('Invoice value and taxable value must be valid.');
    if(Number(vals.ewTotal)<Number(vals.ewTaxable))errs.push('Total invoice value cannot be lower than taxable value.');
    if(!/^[0-9]{6}$/.test(vals.ewFromPin)||!/^[0-9]{6}$/.test(vals.ewToPin))errs.push('Valid 6-digit PIN codes are mandatory.');
    const shipMode=document.getElementById('ewShipMode')?.value;
    if(shipMode==='BillToShipTo'){
      const sg=document.getElementById('ewShipGST')?.value.trim();
      if(!gstinOK(sg))errs.push('Ship-To GSTIN is mandatory and must be valid for Bill-To/Ship-To transactions.');
      if(sg===vals.ewFromGST||sg===vals.ewToGST)errs.push('Bill-To/Ship-To training scenario requires three distinct parties.');
    }
    const mode=document.getElementById('ewMode').value;
    if(mode==='Rail' && !document.getElementById('ewTransDoc').value.trim())errs.push('Transport document number is required for rail.');
    if(mode==='Air' && !document.getElementById('ewTransDoc').value.trim())errs.push('Transport document number is required for air.');
    if(mode==='Ship' && !document.getElementById('ewTransDoc').value.trim())errs.push('Transport document number is required for ship.');
    if(mode==='Road' && document.getElementById('ewVehicle').value.trim() && !vehicleValid(document.getElementById('ewVehicle').value))errs.push('Enter a valid vehicle number for road transport.');
    const out=document.getElementById('ewGenOut');
    if(errs.length){out.innerHTML='<div class="gst-alert error"><b>Please correct:</b><ul>'+errs.map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul></div>';return}
    const modeHasPartB=mode!=='Road'?!!document.getElementById('ewTransDoc').value.trim():!!document.getElementById('ewVehicle').value.trim();
    out.innerHTML='<div class="gst-alert success"><b>Part-A validation successful.</b> '+(modeHasPartB?'Part-B details are present. You can generate the E-Way Bill.':'Transportation details are incomplete. The system will create a Part-A Slip; Part-B can be entered later.')+'</div><div class="gst-action-row"><button class="gst-action" onclick="ewbCommit('+modeHasPartB+')">'+(modeHasPartB?'GENERATE E-WAY BILL':'GENERATE PART-A SLIP')+'</button></div>';
  }
  window.ewbValidatePartA=ewbValidatePartA;
  function ewbCollect(){const g=id=>document.getElementById(id)?.value.trim()||'';return {supply:g('ewSupply'),subSupply:g('ewSub'),docType:g('ewDocType'),docNo:g('ewDocNo'),docDate:g('ewDocDate'),taxable:+g('ewTaxable'),total:+g('ewTotal'),hsn:g('ewHsn'),qty:+g('ewQty'),uqc:g('ewUqc'),fromGST:g('ewFromGST').toUpperCase(),fromState:g('ewFromState'),fromPlace:g('ewFromPlace'),fromPin:g('ewFromPin'),toGST:g('ewToGST').toUpperCase(),toState:g('ewToState'),toPlace:g('ewToPlace'),toPin:g('ewToPin'),shipMode:g('ewShipMode'),shipGST:g('ewShipGST').toUpperCase(),shipPlace:g('ewShipPlace'),shipPin:g('ewShipPin'),mode:g('ewMode'),transGST:g('ewTransGST').toUpperCase(),transDoc:g('ewTransDoc'),transDate:g('ewTransDate'),vehicle:g('ewVehicle').toUpperCase().replace(/[ -]/g,''),vehicleType:g('ewVehicleType'),distance:+g('ewDistance')}}
  function ewbCommit(full){const x=load(),d=ewbCollect();if(full){const no=ref('SIM-EWB',12);const valid=new Date(Date.now()+Math.max(1,Math.ceil(d.distance/200))*86400000);d.no=no;d.status='Active';d.generatedAt=now();d.validUpto=valid.toLocaleDateString('en-IN');d.closedAt='';d.cancelReason='';x.ewbs.push(d);audit(x,'GENERATE E-WAY BILL',no,'','Active');save(x);ewbView(no)}else{const no=ref('SIM-PART-A',10);d.no=no;d.status='Part-A';d.createdAt=now();x.partA.push(d);audit(x,'CREATE PART-A SLIP',no,'','Part-A');save(x);feature('Part-A Slip','e-Way Bill System > Part-A',`<div class="gst-alert success"><b>Part-A Slip generated successfully.</b> This is a simulated training reference.</div><table class="gst-table"><tbody><tr><th>Part-A Slip No.</th><td>${esc(no)}</td></tr><tr><th>Document</th><td>${esc(d.docType)} / ${esc(d.docNo)}</td></tr><tr><th>From</th><td>${esc(d.fromPlace)} - ${esc(d.fromPin)}</td></tr><tr><th>To</th><td>${esc(d.toPlace)} - ${esc(d.toPin)}</td></tr><tr><th>Status</th><td>Part-A</td></tr></tbody></table><div class="gst-action-row"><button class="gst-action" onclick="ewbPartB('${no}')">ENTER PART-B</button><button class="gst-action secondary" onclick="ewbDashboard()">BACK</button></div>`)}}
  window.ewbCommit=ewbCommit;
  function ewbPartAList(){const x=load();feature('Part-A Slips','e-Way Bill System > Part-A',`<div style="overflow:auto"><table class="gst-table"><thead><tr><th>Slip</th><th>Document</th><th>From</th><th>To</th><th>Created</th><th>Status</th><th>Action</th></tr></thead><tbody>${renderTable(x.partA.map(p=>[p.no,p.docType+' / '+p.docNo,p.fromPlace,p.toPlace,p.createdAt,'Part-A',`<button class="gst-action" onclick="ewbPartB('${p.no}')">PART-B</button>`]))}</tbody></table></div><button class="gst-action secondary" onclick="ewbDashboard()">BACK</button>`)}
  window.ewbPartAList=ewbPartAList;
  function ewbPartB(no){const x=load(),p=x.partA.find(a=>a.no===no);if(!p){notify('Part-A Slip not found');return}feature('Update Part-B / Generate E-Way Bill','e-Way Bill System > Part-B',`<div class="gst-alert info"><b>Part-A Slip:</b> ${esc(no)}. Part-A data is retained; enter only transportation details to complete the E-Way Bill.</div><div class="f-card"><div class="gst-form-grid"><div><label>Mode of Transport *</label><select class="f-select" id="pbMode"><option>Road</option><option>Rail</option><option>Air</option><option>Ship</option><option>Road-Cum-Ship</option></select></div><div><label>Transporter ID</label><input class="f-input" id="pbTransGST"></div><div><label>Transport Document No.</label><input class="f-input" id="pbTransDoc"></div><div><label>Transport Document Date</label><input class="f-input" id="pbTransDate" type="date"></div><div><label>Vehicle Number</label><input class="f-input" id="pbVehicle"></div><div><label>Vehicle Type</label><select class="f-select" id="pbVehicleType"><option>Regular</option><option>Over Dimensional Cargo</option></select></div><div><label>Approx. Distance (KM) *</label><input class="f-input" id="pbDistance" type="number" min="1" value="${esc(p.distance||1)}"></div></div></div><div class="gst-action-row"><button class="gst-action" onclick="ewbGenerateFromPartB('${no}')">GENERATE E-WAY BILL</button><button class="gst-action secondary" onclick="ewbPartAList()">BACK</button></div><div id="pbOut"></div>`)}
  window.ewbPartB=ewbPartB;
  function ewbGenerateFromPartB(no){const x=load(),p=x.partA.find(a=>a.no===no),g=id=>document.getElementById(id)?.value.trim()||'',mode=g('pbMode'),veh=g('pbVehicle').toUpperCase().replace(/[ -]/g,''),td=g('pbTransDoc');const errs=[];if(mode==='Road'&&!vehicleValid(veh))errs.push('Valid vehicle number is required for road transport.');if(['Rail','Air','Ship'].includes(mode)&&!td)errs.push('Transport document number is required for the selected mode.');if(!+g('pbDistance'))errs.push('Approximate distance is required.');if(errs.length){document.getElementById('pbOut').innerHTML='<div class="gst-alert error">'+errs.join('<br>')+'</div>';return}const no2=ref('SIM-EWB',12),e={...p,no:no2,mode,transGST:g('pbTransGST').toUpperCase(),transDoc:td,transDate:g('pbTransDate'),vehicle:veh,vehicleType:g('pbVehicleType'),distance:+g('pbDistance'),status:'Active',generatedAt:now(),validUpto:new Date(Date.now()+Math.max(1,Math.ceil(+g('pbDistance')/200))*86400000).toLocaleDateString('en-IN')};x.ewbs.push(e);p.status='Converted';p.convertedTo=no2;audit(x,'PART-A TO E-WAY BILL',no2,'Part-A','Active');save(x);ewbView(no2)}
  window.ewbGenerateFromPartB=ewbGenerateFromPartB;
  function ewbView(no){const x=load(),e=x.ewbs.find(a=>a.no===no);if(!e){notify('E-Way Bill not found');return}feature('E-Way Bill Details','e-Way Bill System > View',`<div class="gst-alert ${e.status==='Active'?'success':'info'}"><b>SIMULATED E-WAY BILL</b> — ${esc(e.status)}</div><div class="gst-form-grid"><div class="f-card"><h3>Basic Details</h3><p><b>EWB No.:</b> ${esc(e.no)}</p><p><b>Generated:</b> ${esc(e.generatedAt)}</p><p><b>Valid Upto:</b> ${esc(e.validUpto)}</p><p><b>Status:</b> ${esc(e.status)}</p><p><b>Supply:</b> ${esc(e.supply)} / ${esc(e.subSupply)}</p></div><div class="f-card"><h3>Document</h3><p><b>Type:</b> ${esc(e.docType)}</p><p><b>No.:</b> ${esc(e.docNo)}</p><p><b>Date:</b> ${esc(e.docDate)}</p><p><b>Taxable:</b> ${money2(e.taxable)}</p><p><b>Total:</b> ${money2(e.total)}</p></div></div><div class="f-card"><h3>Movement</h3><table class="gst-table"><tbody><tr><th>From</th><td>${esc(e.fromGST)} — ${esc(e.fromPlace)} / ${esc(e.fromPin)}</td></tr><tr><th>To</th><td>${esc(e.toGST)} — ${esc(e.toPlace)} / ${esc(e.toPin)}</td></tr><tr><th>Ship-To</th><td>${esc(e.shipGST||'Not applicable')} ${e.shipPlace?'— '+esc(e.shipPlace):''}</td></tr><tr><th>Mode</th><td>${esc(e.mode)}</td></tr><tr><th>Vehicle</th><td>${esc(e.vehicle||'Not entered')}</td></tr><tr><th>Transporter</th><td>${esc(e.transGST||'—')}</td></tr><tr><th>Transport Doc.</th><td>${esc(e.transDoc||'—')}</td></tr><tr><th>Distance</th><td>${esc(e.distance)} KM</td></tr></tbody></table></div><div class="gst-action-row">${e.status==='Active'?`<button class="gst-action" onclick="ewbUpdate('${e.no}')">UPDATE PART-B / TRANSPORTER</button><button class="gst-action" onclick="ewbExtend('${e.no}')">EXTEND VALIDITY</button><button class="gst-action" onclick="ewbCancel('${e.no}')">CANCEL</button><button class="gst-action" onclick="ewbClose('${e.no}')">CLOSE EWB</button>`:''}<button class="gst-action secondary" onclick="ewbPrint('${e.no}')">PRINT / DOWNLOAD</button><button class="gst-action secondary" onclick="ewbDashboard()">BACK</button></div>`)}
  window.ewbView=ewbView;
  function ewbUpdate(no){const x=load(),e=x.ewbs.find(a=>a.no===no);if(!e||e.status!=='Active'){notify('Only active E-Way Bills can be updated');return}feature('Update Part-B / Transporter','e-Way Bill System > Update',`<div class="gst-alert info">Part-A/document details are locked. Only permitted transport/Part-B fields can be updated.</div><div class="f-card"><div class="gst-form-grid"><div><label>Vehicle Number</label><input class="f-input" id="upVeh" value="${esc(e.vehicle||'')}"></div><div><label>Vehicle Type</label><select class="f-select" id="upVT"><option ${e.vehicleType==='Regular'?'selected':''}>Regular</option><option ${e.vehicleType==='Over Dimensional Cargo'?'selected':''}>Over Dimensional Cargo</option></select></div><div><label>Transporter ID</label><input class="f-input" id="upTG" value="${esc(e.transGST||'')}"></div><div><label>Transport Document No.</label><input class="f-input" id="upTD" value="${esc(e.transDoc||'')}"></div><div><label>Transport Document Date</label><input class="f-input" id="upTDate" type="date" value="${esc(e.transDate||'')}"></div><div><label>Distance (KM)</label><input class="f-input" id="upDist" type="number" value="${esc(e.distance||1)}"></div></div></div><button class="gst-action" onclick="ewbSaveUpdate('${no}')">UPDATE PART-B</button><button class="gst-action secondary" onclick="ewbView('${no}')">BACK</button><div id="upOut"></div>`)}
  window.ewbUpdate=ewbUpdate;
  function ewbSaveUpdate(no){const x=load(),e=x.ewbs.find(a=>a.no===no),v=document.getElementById('upVeh').value.toUpperCase().replace(/[ -]/g,''),m=e.mode;if(m==='Road'&&!vehicleValid(v)){document.getElementById('upOut').innerHTML='<div class="gst-alert error">Invalid vehicle number.</div>';return}const old=e.vehicle;e.vehicle=v;e.vehicleType=document.getElementById('upVT').value;e.transGST=document.getElementById('upTG').value.toUpperCase();e.transDoc=document.getElementById('upTD').value;e.transDate=document.getElementById('upTDate').value;e.distance=+document.getElementById('upDist').value||e.distance;e.updatedAt=now();audit(x,'UPDATE PART-B',no,old||'Blank',v||'Blank');save(x);ewbView(no)}
  window.ewbSaveUpdate=ewbSaveUpdate;
  function ewbCancel(no){const x=load(),e=x.ewbs.find(a=>a.no===no);if(!e||e.status!=='Active'){notify('E-Way Bill is not cancellable');return}const age=(Date.now()-new Date(e.generatedAt).getTime())/3600000;if(age>24){feature('Cancel E-Way Bill','e-Way Bill System > Cancel',`<div class="gst-alert error"><b>Cancellation not permitted.</b> The simulated E-Way Bill is older than 24 hours.</div><button class="gst-action secondary" onclick="ewbView('${no}')">BACK</button>`);return}feature('Cancel E-Way Bill','e-Way Bill System > Cancel',`<div class="gst-alert warning">An E-Way Bill cannot be deleted. Cancellation is a status-changing action and must be performed within the permitted period.</div><div class="f-card"><label class="f-label">Cancellation Reason *</label><select class="f-select" id="cancelReason"><option value="Goods not transported">Goods not transported</option><option value="Goods not transported as per details">Goods not transported as per details</option></select><label class="f-label">Remarks *</label><textarea class="f-textarea" id="cancelRemark"></textarea></div><button class="gst-action" onclick="ewbConfirmCancel('${no}')">CANCEL E-WAY BILL</button><button class="gst-action secondary" onclick="ewbView('${no}')">BACK</button>`)}
  window.ewbCancel=ewbCancel;
  function ewbConfirmCancel(no){const x=load(),e=x.ewbs.find(a=>a.no===no),r=document.getElementById('cancelReason').value,rm=document.getElementById('cancelRemark').value.trim();if(!rm){notify('Remarks are mandatory');return}e.status='Cancelled';e.cancelReason=r;e.cancelRemark=rm;e.cancelledAt=now();audit(x,'CANCEL E-WAY BILL',no,'Active','Cancelled');save(x);ewbView(no)}
  window.ewbConfirmCancel=ewbConfirmCancel;
  function ewbExtend(no){const x=load(),e=x.ewbs.find(a=>a.no===no);if(!e||e.status!=='Active'){notify('Only active E-Way Bills can be extended');return}feature('Extend Validity','e-Way Bill System > Extend Validity',`<div class="gst-alert info">Part-A data remains unchanged. Enter the exceptional circumstance, current place, remaining distance and Part-B details.</div><div class="f-card"><label class="f-label">Reason *</label><select class="f-select" id="exReason"><option>Natural calamity</option><option>Law and order issue</option><option>Trans-shipment delay</option><option>Accident of conveyance</option><option>Other exceptional circumstance</option></select><label class="f-label">Detailed reason *</label><textarea class="f-textarea" id="exDetail"></textarea><div class="gst-form-grid"><div><label>Current Place *</label><input class="f-input" id="exPlace"></div><div><label>Remaining Distance (KM) *</label><input class="f-input" id="exDist" type="number" min="1"></div><div><label>Vehicle Number</label><input class="f-input" id="exVeh" value="${esc(e.vehicle||'')}"></div></div></div><button class="gst-action" onclick="ewbConfirmExtend('${no}')">SUBMIT EXTENSION</button><button class="gst-action secondary" onclick="ewbView('${no}')">BACK</button>`)}
  window.ewbExtend=ewbExtend;
  function ewbConfirmExtend(no){const x=load(),e=x.ewbs.find(a=>a.no===no),detail=document.getElementById('exDetail').value.trim(),place=document.getElementById('exPlace').value.trim(),dist=+document.getElementById('exDist').value;if(!detail||!place||!dist){notify('Reason, current place and remaining distance are mandatory');return}const old=e.validUpto;e.validUpto=new Date(Date.now()+Math.max(1,Math.ceil(dist/200))*86400000).toLocaleDateString('en-IN');e.extensionReason=document.getElementById('exReason').value;e.extensionDetail=detail;e.currentPlace=place;e.distanceRemaining=dist;e.extendedAt=now();audit(x,'EXTEND VALIDITY',no,old,e.validUpto);save(x);ewbView(no)}
  window.ewbConfirmExtend=ewbConfirmExtend;
  function ewbClose(no){const x=load(),e=x.ewbs.find(a=>a.no===no);if(!e||e.status!=='Active'){notify('Only active E-Way Bills can be closed');return}feature('E-Way Bill Closure','e-Way Bill System > Closure',`<div class="gst-alert info"><b>2026 EWB Closure.</b> This is a voluntary closure simulation for specified scenarios. It does not delete the E-Way Bill.</div><div class="f-card"><label class="f-label">Closure Reason *</label><select class="f-select" id="clReason"><option>Goods delivered</option><option>Goods movement completed</option><option>Other specified closure scenario</option></select><label class="f-label">Remarks *</label><textarea class="f-textarea" id="clRemark"></textarea></div><button class="gst-action" onclick="ewbConfirmClose('${no}')">CLOSE E-WAY BILL</button><button class="gst-action secondary" onclick="ewbView('${no}')">BACK</button>`)}
  window.ewbClose=ewbClose;
  function ewbConfirmClose(no){const x=load(),e=x.ewbs.find(a=>a.no===no),rm=document.getElementById('clRemark').value.trim();if(!rm){notify('Remarks are mandatory');return}e.status='Closed';e.closedAt=now();e.closeReason=document.getElementById('clReason').value;e.closeRemark=rm;audit(x,'CLOSE E-WAY BILL',no,'Active','Closed');save(x);ewbView(no)}
  window.ewbConfirmClose=ewbConfirmClose;
  function ewbPrint(no){const x=load(),e=x.ewbs.find(a=>a.no===no);if(!e)return;const w=window.open('','_blank');if(!w){notify('Popup blocked. Allow popups to print.');return}w.document.write(`<html><head><title>Simulated E-Way Bill</title><style>body{font-family:Arial;padding:28px;color:#123}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:7px;text-align:left}.water{text-align:center;border:2px solid #900;color:#900;font-weight:bold;padding:10px;margin-bottom:15px}
/* Screen-specific GST Portal fidelity: Returns Dashboard */
.gst-returns-dashboard{font-family:Arial,Helvetica,sans-serif;color:#333}
.gst-real-page{background:#fff;border:1px solid #d5dbe3;min-height:560px}
.gst-real-breadcrumb{height:36px;background:#f3f3f3;border-bottom:1px solid #d5d5d5;padding:9px 14px;color:#777;font-size:12px}
.gst-real-breadcrumb i{font-style:normal;padding:0 8px;color:#aaa}.gst-real-breadcrumb b{color:#444;font-weight:normal}
.gst-real-title-row{display:flex;justify-content:space-between;align-items:center;padding:14px 18px 8px}.gst-real-title-row h2{margin:0;color:#333;font-size:18px;font-weight:normal}.gst-mandatory-note{font-size:11px;color:#666}.gst-mandatory-note b,.gst-real-field em{color:#d11;font-style:normal}
.gst-real-help{margin:0 18px 12px;padding:9px 11px;border:1px solid #e0e0e0;background:#fafafa;color:#555;font-size:11px}
.gst-real-selector{display:grid;grid-template-columns:1fr 1.2fr 1fr auto;gap:16px;align-items:end;background:#f6f6f6;border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:15px 18px}
.gst-real-field label{display:block;font-size:11px;color:#444;margin-bottom:5px}.gst-real-field select{width:100%;height:32px;border:1px solid #bfc5cc;background:#fff;padding:5px 8px;border-radius:1px;color:#333}
.gst-real-search{height:32px;padding:0 24px;border:1px solid #123f70;background:#164b82;color:#fff;font-weight:bold;font-size:12px;border-radius:2px;cursor:pointer}.gst-real-search:hover{background:#103a65}
.gst-real-message{margin:12px 18px;padding:9px 11px;background:#fff8e6;border:1px solid #ecd9a5;color:#6b5a2a;font-size:11px}
.gst-real-results-head{margin:15px 18px 10px;padding:9px 11px;background:#eee;border:1px solid #d5d5d5;font-size:12px;color:#333;display:flex;justify-content:space-between}.gst-real-results-head span{color:#666;font-weight:normal}
.gst-real-tile-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:0 18px 20px;background:#eee}
.gst-real-return-tile{background:#fff;border:1px solid #d4d4d4;min-height:178px;box-shadow:none}
.gst-real-tile-head{background:#143f70;color:#fff;text-align:center;padding:11px 9px 9px;min-height:58px;font-size:13px;font-weight:bold;display:flex;flex-direction:column;justify-content:center}.gst-real-tile-head small{display:block;font-size:11px;font-weight:normal;margin-top:4px;color:#fff}
.gst-real-tile-body{padding:11px 10px 12px;text-align:center}.gst-real-tile-due{font-size:11px;color:#555;margin-bottom:9px}.gst-real-tile-status{font-size:11px;color:#555;margin-bottom:12px}.gst-real-green,.gst-real-teal,.gst-real-orange{font-weight:bold}.gst-real-green{color:#198754}.gst-real-teal{color:#168b8b}.gst-real-orange{color:#c46b00}
.gst-real-tile-actions{display:flex;justify-content:center;gap:7px;flex-wrap:wrap}.gst-real-tile-actions button{min-width:96px;height:29px;padding:0 10px;border:1px solid #123f70;background:#164b82;color:#fff;font-size:10px;font-weight:bold;cursor:pointer;border-radius:1px}.gst-real-tile-actions button.secondary{background:#fff;color:#164b82}.gst-real-tile-actions button:hover{filter:brightness(.94)}
.gst-real-empty{margin:0 18px 20px;padding:28px;text-align:center;background:#eee;border:1px solid #ddd;color:#666;font-size:12px}
@media(max-width:900px){.gst-real-selector{grid-template-columns:1fr 1fr}.gst-real-search{width:100%}.gst-real-tile-grid{grid-template-columns:1fr 1fr}}
</style></head><body><div class="water">SIMULATED TRAINING DOCUMENT — NOT A GOVERNMENT DOCUMENT</div><h2>E-Way Bill</h2><table>${[['EWB No.',e.no],['Status',e.status],['Document',e.docType+' / '+e.docNo],['Document Date',e.docDate],['From',e.fromGST+' / '+e.fromPlace+' / '+e.fromPin],['To',e.toGST+' / '+e.toPlace+' / '+e.toPin],['Ship-To',e.shipGST||'N/A'],['Taxable',money2(e.taxable)],['Invoice Value',money2(e.total)],['Mode',e.mode],['Vehicle',e.vehicle||'N/A'],['Transporter',e.transGST||'N/A'],['Transport Document',e.transDoc||'N/A'],['Distance',e.distance+' KM'],['Valid Upto',e.validUpto]].map(r=>'<tr><th>'+esc(r[0])+'</th><td>'+esc(r[1])+'</td></tr>').join('')}</table><script>window.onload=()=>window.print()<\/script>

</body></html>`);w.document.close()}
  window.ewbPrint=ewbPrint;
  function ewbHistory(){const x=load();feature('E-Way Bill History','e-Way Bill System > History',`<div class="gst-filter-bar"><input class="f-input" id="ewHistQ" placeholder="Search EWB / document / GSTIN"><select class="f-select" id="ewHistS"><option value="">All Status</option><option>Active</option><option>Cancelled</option><option>Closed</option></select><button class="gst-action" onclick="ewbFilterHistory()">SEARCH</button></div><div id="ewHistOut"><div style="overflow:auto"><table class="gst-table"><thead><tr><th>EWB</th><th>Document</th><th>From</th><th>To</th><th>Mode</th><th>Status</th><th>Valid Upto</th><th></th></tr></thead><tbody>${renderTable(x.ewbs.slice().reverse().map(e=>[e.no,e.docNo,e.fromGST,e.toGST,e.mode,e.status,e.validUpto,`<button class="gst-action secondary" onclick="ewbView('${e.no}')">VIEW</button>`]))}</tbody></table></div></div><button class="gst-action secondary" onclick="ewbDashboard()">BACK</button>`)}
  window.ewbHistory=ewbHistory;
  window.ewbFilterHistory=function(){const q=(document.getElementById('ewHistQ').value||'').toLowerCase(),s=document.getElementById('ewHistS').value,x=load();const rows=x.ewbs.filter(e=>(!q||JSON.stringify(e).toLowerCase().includes(q))&&(!s||e.status===s));document.getElementById('ewHistOut').innerHTML='<div style="overflow:auto"><table class="gst-table"><thead><tr><th>EWB</th><th>Document</th><th>From</th><th>To</th><th>Mode</th><th>Status</th><th>Valid Upto</th><th></th></tr></thead><tbody>'+renderTable(rows.map(e=>[e.no,e.docNo,e.fromGST,e.toGST,e.mode,e.status,e.validUpto,`<button class="gst-action secondary" onclick="ewbView('${e.no}')">VIEW</button>`]))+'</tbody></table></div>'}
  function ewbSearch(){feature('Search E-Way Bill','e-Way Bill System > Search',`<div class="f-card"><label class="f-label">E-Way Bill Number</label><input class="f-input" id="ewSearchNo"><button class="gst-action" onclick="ewbDoSearch()">SEARCH</button></div><div id="ewSearchOut"></div>`)}
  window.ewbSearch=ewbSearch;
  window.ewbDoSearch=function(){const n=document.getElementById('ewSearchNo').value.trim(),x=load(),e=x.ewbs.find(a=>a.no===n);document.getElementById('ewSearchOut').innerHTML=e?`<div class="gst-alert success">E-Way Bill found. Status: <b>${esc(e.status)}</b>.</div><button class="gst-action" onclick="ewbView('${e.no}')">VIEW DETAILS</button>`:'<div class="gst-alert error">E-Way Bill not found in the simulator.</div>'}
  function ewbValidity(){feature('Check E-Way Bill Validity','e-Way Bill System > Validity',`<div class="f-card"><label class="f-label">E-Way Bill Number</label><input class="f-input" id="ewValNo"><button class="gst-action" onclick="ewbDoValidity()">CHECK</button></div><div id="ewValOut"></div>`)}
  window.ewbValidity=ewbValidity;
  window.ewbDoValidity=function(){const n=document.getElementById('ewValNo').value.trim(),e=load().ewbs.find(a=>a.no===n);if(!e){document.getElementById('ewValOut').innerHTML='<div class="gst-alert error">Not found.</div>';return}document.getElementById('ewValOut').innerHTML=`<div class="gst-alert ${e.status==='Active'?'success':'warning'}"><b>${esc(e.status)}</b><br>Valid Upto: ${esc(e.validUpto)}<br>Vehicle: ${esc(e.vehicle||'Not entered')}</div>`}
  function ewbReject(){feature('Reject E-Way Bill','e-Way Bill System > Reject',`<div class="gst-alert info">Recipient-side rejection simulation. Only E-Way Bills generated by another party for this GSTIN can be rejected.</div><div class="f-card"><label class="f-label">E-Way Bill Number</label><input class="f-input" id="rejNo"><label class="f-label">Reason *</label><textarea class="f-textarea" id="rejReason"></textarea><button class="gst-action" onclick="ewbDoReject()">REJECT E-WAY BILL</button></div><div id="rejOut"></div>`)}
  window.ewbReject=ewbReject;
  window.ewbDoReject=function(){const n=document.getElementById('rejNo').value.trim(),r=document.getElementById('rejReason').value.trim(),x=load(),e=x.ewbs.find(a=>a.no===n);if(!e){document.getElementById('rejOut').innerHTML='<div class="gst-alert error">E-Way Bill not found.</div>';return}if(!r){notify('Reason is mandatory');return}e.rejected=true;e.rejectReason=r;e.rejectedAt=now();audit(x,'REJECT E-WAY BILL',n,e.status,'Rejected');save(x);document.getElementById('rejOut').innerHTML='<div class="gst-alert success">E-Way Bill marked as rejected in the training simulation.</div>'}
  function ewbConsolidated(){feature('Consolidated E-Way Bill','e-Way Bill System > Consolidated EWB',`<div class="gst-alert info">A Consolidated E-Way Bill is a trip-sheet style document for multiple active E-Way Bills moving in one conveyance. Each individual EWB keeps its own validity.</div><div class="f-card"><div class="gst-form-grid"><div><label>Mode *</label><select class="f-select" id="ceMode"><option>Road</option><option>Rail</option><option>Air</option><option>Ship</option></select></div><div><label>From State *</label><select class="f-select" id="ceState"><option>Kerala</option><option>Karnataka</option><option>TamilNadu</option><option>Maharashtra</option></select></div><div><label>Vehicle No.</label><input class="f-input" id="ceVeh"></div><div><label>Transport Document No.</label><input class="f-input" id="ceDoc"></div><div><label>Transport Document Date</label><input class="f-input" id="ceDate" type="date"></div></div><label class="f-label">E-Way Bill Numbers *</label><textarea class="f-textarea" id="ceList" placeholder="Enter one active EWB number per line"></textarea><button class="gst-action" onclick="ewbMakeConsolidated()">GENERATE CONSOLIDATED EWB</button></div><div id="ceOut"></div>`)}
  window.ewbConsolidated=ewbConsolidated;
  window.ewbMakeConsolidated=function(){const x=load(),list=document.getElementById('ceList').value.split(/\s|,|\n/).map(s=>s.trim()).filter(Boolean),found=list.map(n=>x.ewbs.find(e=>e.no===n));const bad=found.some(e=>!e||e.status!=='Active');if(!list.length||bad){document.getElementById('ceOut').innerHTML='<div class="gst-alert error">Every selected EWB must exist and be active. The simulator also requires the requester to be the generator/transporter.</div>';return}const no=ref('SIM-CEWB',10),c={no,mode:document.getElementById('ceMode').value,fromState:document.getElementById('ceState').value,vehicle:document.getElementById('ceVeh').value.toUpperCase().replace(/[ -]/g,''),transDoc:document.getElementById('ceDoc').value,transDate:document.getElementById('ceDate').value,ewbs:list,generatedAt:now()};x.cewb.push(c);audit(x,'GENERATE CONSOLIDATED EWB',no,'','Generated');save(x);document.getElementById('ceOut').innerHTML=`<div class="gst-alert success"><b>Consolidated EWB generated:</b> ${esc(no)}</div><table class="gst-table"><tbody><tr><th>CEWB</th><td>${esc(no)}</td></tr><tr><th>Individual EWBs</th><td>${esc(list.join(', '))}</td></tr><tr><th>Vehicle</th><td>${esc(c.vehicle||'—')}</td></tr></tbody></table>`}
  function ewbClosure(){feature('E-Way Bill Closure','e-Way Bill System > Closure',`<div class="gst-alert info">Current 2026 E-Way Bill functionality includes voluntary closure for specified scenarios. This training module uses a clearly simulated closure status.</div><div class="f-card"><label class="f-label">E-Way Bill Number</label><input class="f-input" id="clSearch"><button class="gst-action" onclick="ewbClose(document.getElementById('clSearch').value.trim())">CONTINUE</button></div>`)}
  window.ewbClosure=ewbClosure;
  /* Override the older shallow EWB router while preserving all original UI chrome. */
  const oldOpen=window.openFeature;
  window.openFeature=function(t){
    if(t==='eway-generate')return ewbGenerate();
    if(t==='eway-print')return feature('Print / Download E-Way Bill','e-Way Bill System > Print',`<div class="f-card"><label class="f-label">E-Way Bill Number</label><input class="f-input" id="printNo"><button class="gst-action" onclick="ewbPrint(document.getElementById('printNo').value.trim())">PRINT / DOWNLOAD</button></div>`);
    if(t==='eway-update')return feature('Update Vehicle / Transporter','e-Way Bill System > Update',`<div class="f-card"><label class="f-label">E-Way Bill Number</label><input class="f-input" id="updateNo"><button class="gst-action" onclick="ewbUpdate(document.getElementById('updateNo').value.trim())">CONTINUE</button></div>`);
    if(t==='eway-cancel')return feature('Cancel E-Way Bill','e-Way Bill System > Cancel',`<div class="f-card"><label class="f-label">E-Way Bill Number</label><input class="f-input" id="cancelNo"><button class="gst-action" onclick="ewbCancel(document.getElementById('cancelNo').value.trim())">CONTINUE</button></div>`);
    if(t==='eway-reject')return ewbReject();
    if(t==='eway-history')return ewbHistory();
    if(t==='eway-validity')return ewbValidity();
    if(t==='eway-search')return ewbSearch();
    if(t==='eway-consolidated')return ewbConsolidated();
    if(t==='eway-closure')return ewbClosure();
    return oldOpen(t);
  };
  window.eway= function(t){return window.openFeature(t)};
  /* E-Invoice → EWB prefill helper: uses an existing simulated e-Invoice when available. */
  window.ewbFromEInvoice=function(irn){
    try{const q=JSON.parse(localStorage.getItem('GST_SIM_STATE')||'{}'),inv=(q.invoices||[]).find(i=>i.irn===irn);ewbGenerate();if(inv){setTimeout(()=>{const map={ewDocNo:inv.docNo,ewDocDate:inv.docDate,ewTaxable:inv.taxable,ewTotal:inv.total,ewFromGST:inv.sellerGSTIN,ewToGST:inv.buyerGSTIN};Object.entries(map).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v||''})},0)}}catch(e){ewbGenerate()}
  };
})();


/* ===== Extracted script block ===== */


/* ===== FINAL GST SERVICES / COMPLIANCE WORKFLOW LAYER =====
   Preserves the original portal chrome and adds connected training workflows.
   All identifiers and outcomes are simulated and stored locally. */
(function(){
  const KEY='GST_FINAL_SERVICES_V1';
  const esc0=window.esc||function(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))};
  const now=()=>new Date().toISOString();
  const money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const ref=(prefix,n=10)=>prefix+'-SIM-'+Math.random().toString(36).slice(2,2+n).toUpperCase();
  function state(){let x;try{x=JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){x=null}
    if(!x)x={version:1,amendments:[],cancellations:[],revocations:[],luts:[],notices:[],applications:[],communications:[],grievances:[],demands:[],gstp:{registered:false,clients:[],authorizations:[]},appeals:[]};
    return x;
  }
  function save(x){localStorage.setItem(KEY,JSON.stringify(x));return x}
  function audit(x,module,action,refno,detail){x.audit=x.audit||[];x.audit.push({at:now(),module,action,reference:refno||'',detail:detail||''});}
  function nav(title,sub,body){feature(title,sub,body)}
  function status(s){return `<span class="gst-status ${/Approved|Filed|Active|Sanctioned|Resolved|Disbursed|Submitted|Completed/i.test(s)?'green':/Rejected|Cancelled|Failed|Deficient/i.test(s)?'red':'orange'}">${esc0(s)}</span>`}
  function optionList(a,sel){return a.map(v=>`<option ${v===sel?'selected':''}>${esc0(v)}</option>`).join('')}
  function fileSimulation(id){return `<label class="f-label">Supporting Document</label><input class="f-input" id="${id}" type="file" accept=".pdf,.jpg,.jpeg"/><div class="demo-note">Training upload only. Files are not transmitted to any government system.</div>`}

  function amendment(type='Non-Core'){
    const core=type==='Core';
    nav(`Amendment of Registration — ${type} Fields`,`Services > Registration > Amendment of Registration ${type} Fields`,`
      <div class="gst-alert info"><b>${core?'Core':'Non-Core'} amendment</b>. ${core?'Core-field changes follow the submission → ARN → tax-official processing path.':'Non-core fields are updated after successful filing and do not require tax-official approval.'}</div>
      <div class="gst-section-title">1. Select amendment area</div>
      <div class="gst-form-grid">
        <div><label class="f-label">Field Category *</label><select class="f-select" id="amField">${optionList(core?['Legal Name','Principal Place of Business','Additional Place of Business','Constitution of Business','Promoter/Partner change']:['Authorized Signatory','Promoter / Partner','Bank Details','Goods & Services','State Specific Information'])}</select></div>
        <div><label class="f-label">Reason *</label><input class="f-input" id="amReason" placeholder="Reason for amendment"></div>
        <div><label class="f-label">Existing Value</label><input class="f-input" id="amOld" value="Demo existing value"></div>
        <div><label class="f-label">New Value *</label><input class="f-input" id="amNew" placeholder="Enter revised value"></div>
      </div>
      <div class="gst-section-title">2. Supporting documents</div>${fileSimulation('amFile')}
      <div class="gst-section-title">3. Verification</div>
      <div class="gst-form-grid"><div><label class="f-label"><input type="checkbox" id="amVerify"> I hereby verify the information furnished.</label></div><div><label class="f-label">Authorized Signatory *</label><input class="f-input" id="amSign" value="Demo Authorized Signatory"></div><div><label class="f-label">Place *</label><input class="f-input" id="amPlace" value="Thiruvalla"></div></div>
      <div class="gst-action-row"><button class="gst-action" onclick="gstAmendSubmit('${core?'Core':'Non-Core'}')">SAVE & CONTINUE</button><button class="gst-action secondary" onclick="gstAmendHistory()">VIEW AMENDMENT HISTORY</button></div><div id="amMsg"></div>`);
  }
  window.gstAmendSubmit=function(type){const f=id=>document.getElementById(id),m=f('amMsg');if(!f('amNew').value.trim()||!f('amReason').value.trim()||!f('amVerify').checked||!f('amSign').value.trim()||!f('amPlace').value.trim()){m.innerHTML='<div class="gst-alert error"><b>Validation failed.</b> Complete the mandatory amendment and verification fields.</div>';return}const x=state(),a={id:ref('AMEND'),type,field:f('amField').value,reason:f('amReason').value.trim(),oldValue:f('amOld').value,newValue:f('amNew').value.trim(),status:type==='Core'?'Under Processing':'Approved',arn:ref('ARN'),filedAt:now(),history:[{at:now(),status:type==='Core'?'Submitted':'Auto Approved'}]};x.amendments.push(a);audit(x,'Registration Amendment','FILE',a.arn,a.status);save(x);m.innerHTML=`<div class="gst-alert success"><b>Application submitted successfully.</b><br>Simulated ARN: <b>${esc0(a.arn)}</b><br>Status: ${status(a.status)}</div><table class="gst-table"><tr><th>Type</th><td>${esc0(a.type)}</td><th>Field</th><td>${esc0(a.field)}</td></tr></table>`}
  window.gstAmendHistory=function(){const x=state();nav('Amendment History','Services > Registration > Amendment History',`<table class="gst-table"><thead><tr><th>ARN</th><th>Type</th><th>Field</th><th>Filed</th><th>Status</th><th>Action</th></tr></thead><tbody>${x.amendments.map(a=>`<tr><td>${esc0(a.arn)}</td><td>${esc0(a.type)}</td><td>${esc0(a.field)}</td><td>${new Date(a.filedAt).toLocaleString('en-IN')}</td><td>${status(a.status)}</td><td><button class="gst-action secondary" onclick="gstAmendView('${a.arn}')">VIEW</button></td></tr>`).join('')||'<tr><td colspan="6">No amendment applications.</td></tr>'}</tbody></table>`)};
  window.gstAmendView=function(arn){const a=state().amendments.find(v=>v.arn===arn);if(!a)return notify('Application not found');nav('Amendment Application','My Applications > Amendment',`<table class="gst-table"><tr><th>ARN</th><td>${esc0(a.arn)}</td><th>Status</th><td>${status(a.status)}</td></tr><tr><th>Field</th><td>${esc0(a.field)}</td><th>Reason</th><td>${esc0(a.reason)}</td></tr><tr><th>Old Value</th><td>${esc0(a.oldValue)}</td><th>New Value</th><td>${esc0(a.newValue)}</td></tr></table>${a.type==='Core'&&a.status==='Under Processing'?'<button class="gst-action" onclick="gstOfficerAmend(\''+a.arn+'\')">SIMULATE OFFICER DECISION</button>':''}`)};
  window.gstOfficerAmend=function(arn){const x=state(),a=x.amendments.find(v=>v.arn===arn);if(!a)return;if(a.type!=='Core')return;if(a.status==='Under Processing'){a.status='Approved';a.history.push({at:now(),status:'Approved'});audit(x,'Registration Amendment','OFFICER APPROVE',arn,'Approved');save(x)}gstAmendView(arn)};

  function cancellation(){nav('Cancellation of Registration — REG-16','Services > Registration > Application for Cancellation of Registration',`<div class="gst-alert warning"><b>REG-16 training workflow.</b> Cancellation changes the simulated GSTIN status to Inactive only after the officer-order stage.</div><div class="gst-form-grid"><div><label class="f-label">Reason for Cancellation *</label><select class="f-select" id="canReason">${optionList(['Discontinuation/closure of business','Transfer of business','Change in constitution','Ceased to be liable to pay tax','Death of sole proprietor','Other'])}</select></div><div><label class="f-label">Effective Cancellation Date *</label><input class="f-input" id="canDate" type="date"></div><div><label class="f-label">Stock / Liability Details *</label><textarea class="f-textarea" id="canDetails" placeholder="Enter closing stock and liability details"></textarea></div><div><label class="f-label">Address for Future Correspondence *</label><textarea class="f-textarea" id="canAddr">Demo Business Address, Kerala</textarea></div></div><div class="gst-section-title">Verification</div><label class="f-label"><input type="checkbox" id="canVerify"> I verify that the information is true and complete.</label><div class="gst-form-grid"><div><label class="f-label">Authorized Signatory *</label><input class="f-input" id="canSign" value="Demo Authorized Signatory"></div><div><label class="f-label">Place *</label><input class="f-input" id="canPlace" value="Thiruvalla"></div></div><button class="gst-action" onclick="gstCancelSubmit()">SUBMIT APPLICATION</button><div id="canMsg"></div>`)}
  window.gstCancelSubmit=function(){const f=id=>document.getElementById(id),m=f('canMsg');if(!f('canDate').value||!f('canDetails').value.trim()||!f('canVerify').checked){m.innerHTML='<div class="gst-alert error">Complete the mandatory cancellation fields.</div>';return}const x=state(),a={arn:ref('ARN'),reason:f('canReason').value,date:f('canDate').value,status:'Pending for Processing',filedAt:now(),notice:null,order:null};x.cancellations.push(a);audit(x,'Registration Cancellation','FILE REG-16',a.arn,a.reason);save(x);m.innerHTML=`<div class="gst-alert success">REG-16 submitted. Simulated ARN: <b>${esc0(a.arn)}</b><br>Status: ${status(a.status)}</div><button class="gst-action secondary" onclick="gstCancelCase('${a.arn}')">OPEN CASE</button>`};
  window.gstCancelCase=function(arn){const x=state(),a=x.cancellations.find(v=>v.arn===arn);if(!a)return;nav('Cancellation Proceedings','Registration > Cancellation > Case',`<table class="gst-table"><tr><th>ARN</th><td>${esc0(a.arn)}</td><th>Status</th><td>${status(a.status)}</td></tr><tr><th>Reason</th><td>${esc0(a.reason)}</td><th>Effective Date</th><td>${esc0(a.date)}</td></tr></table><div class="gst-section-title">Officer simulation</div><button class="gst-action" onclick="gstCancelOfficer('${arn}','SCN')">ISSUE REG-17 SHOW CAUSE NOTICE</button> <button class="gst-action secondary" onclick="gstCancelOfficer('${arn}','DROP')">DROP PROCEEDINGS (REG-20)</button> <button class="gst-action secondary" onclick="gstCancelOfficer('${arn}','ORDER')">ISSUE CANCELLATION ORDER (REG-19)</button>${a.notice?`<div class="gst-alert warning"><b>REG-17 issued.</b> Reason: ${esc0(a.notice.reason)}<br><button class="gst-action" onclick="gstCancelReply('${arn}')">FILE REG-18 REPLY</button></div>`:''}`)};
  window.gstCancelOfficer=function(arn,action){const x=state(),a=x.cancellations.find(v=>v.arn===arn);if(!a)return;if(action==='SCN'){a.notice={no:ref('REG17'),reason:'Clarification required before cancellation'};a.status='Notice Issued';audit(x,'Cancellation','ISSUE REG-17',arn,'Show Cause Notice')}else if(action==='DROP'){a.status='Proceedings Dropped';a.order={no:ref('REG20'),type:'REG-20'};audit(x,'Cancellation','ISSUE REG-20',arn,'Dropped')}else{a.status='Cancelled / Inactive';a.order={no:ref('REG19'),type:'REG-19'};audit(x,'Cancellation','ISSUE REG-19',arn,'Cancelled')};save(x);gstCancelCase(arn)};
  window.gstCancelReply=function(arn){const x=state(),a=x.cancellations.find(v=>v.arn===arn);if(!a)return;nav('Reply to Cancellation Notice — REG-18','Registration > Cancellation > Reply',`<div class="gst-alert warning">Notice ${esc0(a.notice.no)} requires a taxpayer reply.</div><label class="f-label">Reply / Clarification *</label><textarea class="f-textarea" id="canReply" placeholder="Enter clarification"></textarea>${fileSimulation('canReplyFile')}<button class="gst-action" onclick="gstCancelReplySubmit('${arn}')">SUBMIT REG-18 REPLY</button>`)};
  window.gstCancelReplySubmit=function(arn){const r=document.getElementById('canReply')?.value.trim();if(!r)return notify('Reply is mandatory');const x=state(),a=x.cancellations.find(v=>v.arn===arn);a.reply={text:r,at:now(),status:'Reply Submitted'};a.status='Reply Submitted';audit(x,'Cancellation','FILE REG-18',arn,'Reply submitted');save(x);gstCancelCase(arn)};

  function revocation(){const x=state();nav('Revocation of Cancellation — REG-21','Services > Registration > Application for Revocation of Cancellation',`<div class="gst-alert info">REG-21 is used for revocation of cancellation in applicable cases. The simulator enforces Aadhaar/e-KYC for a normal taxpayer and models the published 30/90-day training window.</div><div class="gst-form-grid"><div><label class="f-label">Cancelled Registration / Order ARN *</label><input class="f-input" id="revArn" placeholder="Enter cancellation ARN"></div><div><label class="f-label">Cancellation Order Date *</label><input class="f-input" id="revOrderDate" type="date"></div><div><label class="f-label">Reason for Revocation *</label><textarea class="f-textarea" id="revReason"></textarea></div><div><label class="f-label">Aadhaar / E-KYC Status *</label><select class="f-select" id="revKyc"><option>Verified</option><option>Pending</option><option>Failed</option></select></div></div>${fileSimulation('revFile')}<label class="f-label"><input type="checkbox" id="revVerify"> I verify the application.</label><button class="gst-action" onclick="gstRevSubmit()">SUBMIT REG-21</button><div id="revMsg"></div>`)}
  window.gstRevSubmit=function(){const f=id=>document.getElementById(id),m=f('revMsg'),d=f('revOrderDate').value;if(!f('revArn').value.trim()||!d||!f('revReason').value.trim()||!f('revVerify').checked){m.innerHTML='<div class="gst-alert error">Complete all mandatory REG-21 fields.</div>';return}if(f('revKyc').value!=='Verified'){m.innerHTML='<div class="gst-alert error"><b>Aadhaar/e-KYC verification is required.</b> Complete verification before filing REG-21.</div>';return}const age=(Date.now()-new Date(d).getTime())/86400000;if(age<0||age>90){m.innerHTML='<div class="gst-alert error">The simulated revocation filing window is outside the configured training period.</div>';return}const x=state(),a={arn:ref('ARN'),cancelArn:f('revArn').value.trim(),orderDate:d,reason:f('revReason').value.trim(),status:'Under Processing',filedAt:now(),kyc:'Verified'};x.revocations.push(a);audit(x,'Registration Revocation','FILE REG-21',a.arn,'Under Processing');save(x);m.innerHTML=`<div class="gst-alert success">REG-21 filed successfully. Simulated ARN: <b>${esc0(a.arn)}</b>.</div><button class="gst-action" onclick="gstRevOfficer('${a.arn}')">SIMULATE OFFICER DECISION</button>`};
  window.gstRevOfficer=function(arn){const x=state(),a=x.revocations.find(v=>v.arn===arn);if(!a)return;a.status='Approved — Registration Restored';audit(x,'Registration Revocation','APPROVE REG-21',arn,'GSTIN restored in training state');save(x);nav('Revocation Approved','Registration > Revocation',`<div class="gst-alert success"><b>REG-21 approved.</b> Simulated GSTIN status restored to Active.</div><table class="gst-table"><tr><th>ARN</th><td>${esc0(a.arn)}</td><th>Status</th><td>${status(a.status)}</td></tr></table>`) };

  function lut(){nav('Letter of Undertaking (LUT)','Services > User Services > Furnish Letter of Undertaking (LUT)',`<div class="gst-alert info"><b>LUT training workflow.</b> The application is simulated and does not create a valid government LUT.</div><div class="gst-form-grid"><div><label class="f-label">Financial Year *</label><select class="f-select" id="lutFy">${optionList(['2026-27','2025-26','2024-25'])}</select></div><div><label class="f-label">Registered Person / GSTIN</label><input class="f-input" value="32ABCDE1234F1Z5" readonly></div><div><label class="f-label">Witness 1 Name *</label><input class="f-input" id="lutW1"></div><div><label class="f-label">Witness 2 Name *</label><input class="f-input" id="lutW2"></div></div><label class="f-label"><input type="checkbox" id="lutDecl"> I undertake to comply with the conditions applicable to zero-rated supplies under LUT.</label><div class="gst-section-title">Verification</div><div class="gst-form-grid"><div><label class="f-label">Authorized Signatory *</label><input class="f-input" id="lutSign" value="Demo Authorized Signatory"></div><div><label class="f-label">Place *</label><input class="f-input" id="lutPlace" value="Thiruvalla"></div></div><button class="gst-action" onclick="gstLutSubmit()">SUBMIT LUT</button><button class="gst-action secondary" onclick="gstLutHistory()">VIEW LUT HISTORY</button><div id="lutMsg"></div>`)}
  window.gstLutSubmit=function(){const f=id=>document.getElementById(id),m=f('lutMsg');if(!f('lutW1').value.trim()||!f('lutW2').value.trim()||!f('lutDecl').checked){m.innerHTML='<div class="gst-alert error">Witness details and declaration are mandatory.</div>';return}const x=state(),a={arn:ref('LUT'),fy:f('lutFy').value,w1:f('lutW1').value,w2:f('lutW2').value,status:'Filed',filedAt:now()};x.luts.push(a);audit(x,'LUT','FILE RFD-11 STYLE LUT',a.arn,a.fy);save(x);m.innerHTML=`<div class="gst-alert success"><b>LUT submitted in the training simulator.</b><br>Simulated ARN: <b>${esc0(a.arn)}</b><br>Status: ${status(a.status)}</div>`};
  window.gstLutHistory=function(){const x=state();nav('LUT History','Services > LUT > History',`<table class="gst-table"><thead><tr><th>ARN</th><th>FY</th><th>Filed</th><th>Status</th><th>Action</th></tr></thead><tbody>${x.luts.map(a=>`<tr><td>${esc0(a.arn)}</td><td>${esc0(a.fy)}</td><td>${new Date(a.filedAt).toLocaleString('en-IN')}</td><td>${status(a.status)}</td><td><button class="gst-action secondary" onclick="notify('Simulated LUT document opened')">VIEW</button></td></tr>`).join('')||'<tr><td colspan="5">No LUT applications.</td></tr>'}</tbody></table>`)};

  function notices(){const x=state();if(!x.notices.length)x.notices=[{no:'SIM-NOT-001',type:'Return Clarification',date:now(),due:'2026-08-20',status:'Reply Pending',subject:'Clarification required on reported outward supplies',reply:null},{no:'SIM-NOT-002',type:'Registration Notice',date:new Date(Date.now()-86400000*3).toISOString(),due:'2026-08-18',status:'Closed',subject:'Verification of registration particulars',reply:'Clarification accepted'}];save(x);nav('Notices & Orders','Services > User Services > View Notices and Orders',`<div class="gst-action-row"><button class="gst-action" onclick="gstNoticeOfficer()">SIMULATE OFFICER NOTICE</button><button class="gst-action secondary" onclick="gstNoticeRefresh()">REFRESH</button></div><table class="gst-table"><thead><tr><th>Notice No.</th><th>Type</th><th>Date</th><th>Due Date</th><th>Subject</th><th>Status</th><th></th></tr></thead><tbody>${x.notices.map(n=>`<tr><td>${esc0(n.no)}</td><td>${esc0(n.type)}</td><td>${new Date(n.date).toLocaleDateString('en-IN')}</td><td>${esc0(n.due)}</td><td>${esc0(n.subject)}</td><td>${status(n.status)}</td><td><button class="gst-action secondary" onclick="gstNoticeView('${n.no}')">VIEW</button></td></tr>`).join('')}</tbody></table>`)}
  window.gstNoticeRefresh=notices;
  window.gstNoticeView=function(no){const n=state().notices.find(v=>v.no===no);if(!n)return;nav(`Notice / Order — ${no}`,'Services > User Services > Notice Details',`<div class="gst-alert ${n.status==='Reply Pending'?'warning':'info'}"><b>${esc0(n.type)}</b> — ${esc0(n.subject)}</div><table class="gst-table"><tr><th>Notice No.</th><td>${esc0(n.no)}</td><th>Status</th><td>${status(n.status)}</td></tr><tr><th>Issue Date</th><td>${new Date(n.date).toLocaleDateString('en-IN')}</td><th>Due Date</th><td>${esc0(n.due)}</td></tr></table>${n.reply?`<div class="gst-alert success">Reply: ${esc0(n.reply)}</div>`:`<label class="f-label">Reply / Clarification *</label><textarea class="f-textarea" id="noticeReply"></textarea>${fileSimulation('noticeFile')}<button class="gst-action" onclick="gstNoticeReply('${no}')">SUBMIT REPLY</button>`}`)};
  window.gstNoticeReply=function(no){const r=document.getElementById('noticeReply')?.value.trim();if(!r)return notify('Reply is mandatory');const x=state(),n=x.notices.find(v=>v.no===no);n.reply=r;n.status='Reply Submitted';n.repliedAt=now();audit(x,'Notices & Proceedings','REPLY',no,'Reply submitted');save(x);gstNoticeView(no)};
  window.gstNoticeOfficer=function(){const x=state(),n={no:ref('SCN'),type:'Show Cause Notice',date:now(),due:new Date(Date.now()+86400000*7).toISOString().slice(0,10),status:'Reply Pending',subject:'Simulated officer show cause notice',reply:null};x.notices.push(n);audit(x,'Notices & Proceedings','ISSUE NOTICE',n.no,n.subject);save(x);gstNoticeView(n.no)};

  function applications(){const x=state();nav('My Applications','Services > User Services > My Applications',`<div class="gst-form-grid"><div><label class="f-label">Application Type</label><select class="f-select" id="appType"><option>Registration Amendment</option><option>Refund</option><option>LUT</option><option>Cancellation</option><option>Revocation</option><option>Appeal</option><option>Other</option></select></div><div><label class="f-label">From Date</label><input class="f-input" id="appFrom" type="date"></div><div><label class="f-label">To Date</label><input class="f-input" id="appTo" type="date"></div></div><button class="gst-action" onclick="gstAppSearch()">SEARCH</button><div id="appOut"></div>`)}
  window.gstAppSearch=function(){const x=state(),type=document.getElementById('appType').value;let rows=[];x.amendments.filter(a=>type==='Registration Amendment').forEach(a=>rows.push(['Registration Amendment',a.arn,a.filedAt,a.status]));x.luts.filter(a=>type==='LUT').forEach(a=>rows.push(['LUT',a.arn,a.filedAt,a.status]));x.cancellations.filter(a=>type==='Cancellation').forEach(a=>rows.push(['Cancellation',a.arn,a.filedAt,a.status]));x.revocations.filter(a=>type==='Revocation').forEach(a=>rows.push(['Revocation',a.arn,a.filedAt,a.status]));x.appeals.filter(a=>type==='Appeal').forEach(a=>rows.push(['Appeal',a.arn,a.filedAt,a.status]));document.getElementById('appOut').innerHTML=`<table class="gst-table"><thead><tr><th>Application</th><th>ARN</th><th>Filed</th><th>Status</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc0(r[0])}</td><td>${esc0(r[1])}</td><td>${new Date(r[2]).toLocaleString('en-IN')}</td><td>${status(r[3])}</td></tr>`).join('')||'<tr><td colspan="4">No applications found.</td></tr>'}</tbody></table>`};

  function communication(){const x=state();nav('Communication Between Taxpayers','Services > User Services > Communication Between Taxpayers',`<div class="gst-tabs"><button class="gst-tab active" onclick="gstCommInbox()">INBOX</button><button class="gst-tab" onclick="gstCommCompose()">+ COMPOSE</button><button class="gst-tab" onclick="gstCommOutbox()">OUTBOX</button><button class="gst-tab" onclick="gstCommCsv()">DOWNLOAD CSV TEMPLATE</button></div><div id="commOut"></div>`);gstCommInbox()}
  function commRow(c,reply){return `<tr><td>${esc0(c.no)}</td><td>${esc0(c.party)}</td><td>${esc0(c.subject)}</td><td>${new Date(c.at).toLocaleString('en-IN')}</td><td>${status(c.status)}</td><td><button class="gst-action secondary" onclick="gstCommView('${c.no}',${reply?'true':'false'})">VIEW</button></td></tr>`}
  window.gstCommInbox=function(){const x=state(),inb=x.communications.filter(c=>c.direction==='IN');document.getElementById('commOut').innerHTML=`<div class="gst-section-title">Notification & Reply Received</div><table class="gst-table"><thead><tr><th>Notification No.</th><th>From</th><th>Subject</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody>${inb.map(c=>commRow(c,true)).join('')||'<tr><td colspan="6">No notifications.</td></tr>'}</tbody></table>`}
  window.gstCommCompose=function(){document.getElementById('commOut').innerHTML=`<div class="gst-section-title">Compose Notification</div><div class="gst-form-grid"><div><label class="f-label">Counterparty Type *</label><select class="f-select" id="cmPartyType"><option>Supplier</option><option>Recipient</option></select></div><div><label class="f-label">Counterparty GSTIN *</label><input class="f-input" id="cmGstin" value="29ABCDE1234F1Z5"></div><div><label class="f-label">Subject *</label><select class="f-select" id="cmSubject"><option>Missing Document</option><option>Rejected-Amendment Required</option><option>Rejected-Wrongly sent to me</option><option>Re-Uploaded document</option><option>Payment made</option><option>Others</option></select></div><div><label class="f-label">Tax Period</label><input class="f-input" id="cmPeriod" value="Jul 2026"></div></div><label class="f-label">Remarks * (maximum 200 characters)</label><textarea class="f-textarea" id="cmRemark" maxlength="200"></textarea><label class="f-label">Document References (maximum 50)</label><textarea class="f-textarea" id="cmDocs" placeholder="One invoice / document number per line"></textarea>${fileSimulation('cmFile')}<button class="gst-action" onclick="gstCommSend()">SEND</button>`}
  window.gstCommSend=function(){const f=id=>document.getElementById(id),r=f('cmRemark').value.trim(),docs=f('cmDocs').value.split(/\n|,/).map(v=>v.trim()).filter(Boolean);if(!f('cmGstin').value.trim()||!r){return notify('GSTIN and remarks are mandatory')}if(r.length>200||docs.length>50){return notify('Document/remark limit exceeded')}const x=state(),no=ref('NTF'),c={no,direction:'OUT',party:f('cmGstin').value.trim(),partyType:f('cmPartyType').value,subject:f('cmSubject').value,period:f('cmPeriod').value,remark:r,docs,at:now(),status:'Sent',reply:null};x.communications.push(c);audit(x,'Communication Between Taxpayers','SEND NOTIFICATION',no,c.subject);save(x);gstCommOutbox()};
  window.gstCommOutbox=function(){const x=state(),out=x.communications.filter(c=>c.direction==='OUT');document.getElementById('commOut').innerHTML=`<div class="gst-section-title">Notification & Reply Sent</div><table class="gst-table"><thead><tr><th>Notification No.</th><th>To</th><th>Subject</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody>${out.map(c=>commRow(c,false)).join('')||'<tr><td colspan="6">No sent notifications.</td></tr>'}</tbody></table>`}
  window.gstCommView=function(no,inbox){const x=state(),c=x.communications.find(v=>v.no===no);if(!c)return;document.getElementById('commOut').innerHTML=`<div class="gst-alert info"><b>${esc0(c.subject)}</b><br>${esc0(c.remark||'')}</div><table class="gst-table"><tr><th>Notification</th><td>${esc0(c.no)}</td><th>Party</th><td>${esc0(c.party)}</td></tr><tr><th>Documents</th><td colspan="3">${esc0((c.docs||[]).join(', ')||'None')}</td></tr></table>${inbox&&!c.reply?`<label class="f-label">Reply / Take Action *</label><textarea class="f-textarea" id="cmReply"></textarea>${fileSimulation('cmReplyFile')}<button class="gst-action" onclick="gstCommReply('${no}')">SEND REPLY</button>`:c.reply?`<div class="gst-alert success"><b>Reply:</b> ${esc0(c.reply)}</div>`:''}`}
  window.gstCommReply=function(no){const r=document.getElementById('cmReply')?.value.trim();if(!r)return notify('Reply is mandatory');const x=state(),c=x.communications.find(v=>v.no===no);c.reply=r;c.replyAt=now();c.status='Reply Sent';audit(x,'Communication Between Taxpayers','REPLY',no,'Reply sent');save(x);gstCommView(no,true)};
  window.gstCommCsv=function(){const csv='GSTIN,Party Type,Subject,Tax Period,Remarks,Document No\n29ABCDE1234F1Z5,Supplier,Missing Document,Jul 2026,Please upload missing invoice,INV-1001\n';const blob=new Blob([csv],{type:'text/csv'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='GST_Communication_Template.csv';a.click();URL.revokeObjectURL(u)};

  function grievance(){const x=state();nav('Grievance Redressal','Services > User Services > Grievance Redressal',`<div class="gst-tabs"><button class="gst-tab active" onclick="gstGrievanceNew()">LODGE GRIEVANCE</button><button class="gst-tab" onclick="gstGrievanceHistory()">MY GRIEVANCES</button></div><div id="grOut"></div>`);gstGrievanceNew()}
  // Bug fix: same pattern as refundApply — this real grievance workflow (lodge, track,
  // resolve) is IIFE-scoped and never overwrote the old dead top-level `function grievance(){}`
  // placeholder, so 'Grievance Redressal' in the menu was unreachable. Exposing it globally.
  window.grievance=grievance;
  window.gstGrievanceNew=function(){document.getElementById('grOut').innerHTML=`<div class="gst-form-grid"><div><label class="f-label">Category *</label><select class="f-select" id="grCat"><option>Registration</option><option>Returns</option><option>Payment / Challan</option><option>Ledger</option><option>Refund</option><option>e-Invoice</option><option>e-Way Bill</option><option>Technical Issue</option><option>Other</option></select></div><div><label class="f-label">Sub-category</label><input class="f-input" id="grSub"></div><div><label class="f-label">Reference / ARN</label><input class="f-input" id="grRef"></div></div><label class="f-label">Description *</label><textarea class="f-textarea" id="grDesc"></textarea>${fileSimulation('grFile')}<button class="gst-action" onclick="gstGrievanceSubmit()">SUBMIT GRIEVANCE</button>`}
  window.gstGrievanceSubmit=function(){const d=document.getElementById('grDesc').value.trim();if(!d)return notify('Description is mandatory');const x=state(),g={no:ref('GRV'),category:document.getElementById('grCat').value,sub:document.getElementById('grSub').value,reference:document.getElementById('grRef').value,description:d,status:'Submitted',at:now(),history:[{at:now(),status:'Submitted'}]};x.grievances.push(g);audit(x,'Grievance','LODGE',g.no,g.category);save(x);gstGrievanceHistory()}
  window.gstGrievanceHistory=function(){const x=state();document.getElementById('grOut').innerHTML=`<table class="gst-table"><thead><tr><th>Reference No.</th><th>Category</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody>${x.grievances.map(g=>`<tr><td>${esc0(g.no)}</td><td>${esc0(g.category)}</td><td>${new Date(g.at).toLocaleString('en-IN')}</td><td>${status(g.status)}</td><td><button class="gst-action secondary" onclick="gstGrievanceView('${g.no}')">VIEW</button></td></tr>`).join('')||'<tr><td colspan="5">No grievances.</td></tr>'}</tbody></table>`}
  window.gstGrievanceView=function(no){const x=state(),g=x.grievances.find(v=>v.no===no);if(!g)return;nav('Grievance Details','Services > User Services > Grievance Details',`<table class="gst-table"><tr><th>Reference</th><td>${esc0(g.no)}</td><th>Status</th><td>${status(g.status)}</td></tr><tr><th>Category</th><td>${esc0(g.category)}</td><th>Related Reference</th><td>${esc0(g.reference||'—')}</td></tr><tr><th>Description</th><td colspan="3">${esc0(g.description)}</td></tr></table><div class="gst-section-title">Workflow</div><button class="gst-action" onclick="gstGrievanceUpdate('${no}','Under Processing')">MARK UNDER PROCESSING</button> <button class="gst-action secondary" onclick="gstGrievanceUpdate('${no}','Resolved')">RESOLVE</button>`)};
  window.gstGrievanceUpdate=function(no,s){const x=state(),g=x.grievances.find(v=>v.no===no);if(!g)return;g.status=s;g.history.push({at:now(),status:s});audit(x,'Grievance','STATUS',no,s);save(x);gstGrievanceView(no)};

  function gstp(){const x=state();nav('GST Practitioner','Services > User Services > GST Practitioner',`<div class="gst-alert info">GSTP training area. Client access and authorizations are simulated locally; no real GSTP credential is created.</div><div class="gst-tabs"><button class="gst-tab active" onclick="gstpRegister()">REGISTRATION</button><button class="gst-tab" onclick="gstpClients()">MY CLIENTS</button><button class="gst-tab" onclick="gstpAuthorizations()">AUTHORIZATIONS</button></div><div id="gstpOut"></div>`);gstpRegister()}
  // Bug fix: same pattern again — this real GST Practitioner workflow (register, clients,
  // authorizations) never overwrote the old dead top-level `function gstp(){}` placeholder.
  window.gstp=gstp;
  window.gstpRegister=function(){const x=state();document.getElementById('gstpOut').innerHTML=`<div class="gst-form-grid"><div><label class="f-label">Name *</label><input class="f-input" id="gpName" value="Demo GST Practitioner"></div><div><label class="f-label">Enrollment / Qualification Ref *</label><input class="f-input" id="gpRef"></div><div><label class="f-label">Mobile *</label><input class="f-input" id="gpMobile" value="9999999999"></div><div><label class="f-label">Email *</label><input class="f-input" id="gpEmail" value="gstp@example.test"></div></div><label class="f-label"><input type="checkbox" id="gpDecl"> I declare the information is correct.</label><button class="gst-action" onclick="gstpSubmit()">SUBMIT GSTP APPLICATION</button><div class="demo-note">Simulation only. No actual GSTP enrolment is created.</div>`}
  window.gstpSubmit=function(){const x=state();if(!document.getElementById('gpDecl').checked)return notify('Declaration required');x.gstp.registered=true;x.gstp.arn=ref('GSTP');x.gstp.status='Approved';audit(x,'GST Practitioner','REGISTER',x.gstp.arn,'Approved');save(x);gstpClients()}
  window.gstpClients=function(){const x=state();document.getElementById('gstpOut').innerHTML=`<div class="gst-action-row"><button class="gst-action" onclick="gstpAddClient()">ADD CLIENT</button></div><table class="gst-table"><thead><tr><th>GSTIN</th><th>Legal Name</th><th>Authorization</th><th>Status</th></tr></thead><tbody>${x.gstp.clients.map(c=>`<tr><td>${esc0(c.gstin)}</td><td>${esc0(c.name)}</td><td>${esc0(c.auth)}</td><td>${status(c.status)}</td></tr>`).join('')||'<tr><td colspan="4">No clients added.</td></tr>'}</tbody></table>`}
  window.gstpAddClient=function(){document.getElementById('gstpOut').innerHTML=`<div class="gst-form-grid"><div><label class="f-label">Client GSTIN *</label><input class="f-input" id="gpClientGstin" value="32ABCDE1234F1Z5"></div><div><label class="f-label">Legal Name *</label><input class="f-input" id="gpClientName" value="Demo Taxpayer"></div></div><label class="f-label"><input type="checkbox" id="gpClientAuth"> Client authorization received.</label><button class="gst-action" onclick="gstpSaveClient()">SAVE CLIENT</button>`}
  window.gstpSaveClient=function(){const x=state();if(!document.getElementById('gpClientAuth').checked)return notify('Client authorization is required');x.gstp.clients.push({gstin:document.getElementById('gpClientGstin').value.trim(),name:document.getElementById('gpClientName').value.trim(),auth:'Authorized',status:'Active',at:now()});audit(x,'GST Practitioner','ADD CLIENT',x.gstp.clients.at(-1).gstin,'Authorized');save(x);gstpClients()}
  window.gstpAuthorizations=function(){const x=state();document.getElementById('gstpOut').innerHTML=`<table class="gst-table"><thead><tr><th>Client</th><th>Authorization</th><th>Date</th><th>Status</th></tr></thead><tbody>${x.gstp.clients.map(c=>`<tr><td>${esc0(c.gstin)}</td><td>${esc0(c.auth)}</td><td>${new Date(c.at).toLocaleString('en-IN')}</td><td>${status(c.status)}</td></tr>`).join('')||'<tr><td colspan="4">No authorizations.</td></tr>'}</tbody></table>`}

  function demand(){const x=state();if(!x.demands.length)x.demands=[{id:'SIM-DEMAND-001',date:'2026-07-20',type:'Tax Demand',tax:15000,interest:750,penalty:0,status:'Outstanding',paid:0}];save(x);nav('Demand & Recovery','Services > User Services > Demand and Recovery',`<div class="gst-alert warning">Training demand register. Any payment/adjustment is simulated and does not create a government demand.</div><table class="gst-table"><thead><tr><th>Demand ID</th><th>Date</th><th>Type</th><th>Total</th><th>Paid</th><th>Outstanding</th><th>Status</th><th></th></tr></thead><tbody>${x.demands.map(d=>{const total=d.tax+d.interest+d.penalty,due=total-d.paid;return `<tr><td>${esc0(d.id)}</td><td>${esc0(d.date)}</td><td>${esc0(d.type)}</td><td>${money(total)}</td><td>${money(d.paid)}</td><td>${money(due)}</td><td>${status(due<=0?'Paid':'Outstanding')}</td><td><button class="gst-action secondary" onclick="gstDemandView('${d.id}')">VIEW / PAY</button></td></tr>`}).join('')}</tbody></table>`)}
  window.gstDemandView=function(id){const x=state(),d=x.demands.find(v=>v.id===id);if(!d)return;const total=d.tax+d.interest+d.penalty,due=total-d.paid;nav('Demand Details','Demand & Recovery > Demand',`<table class="gst-table"><tr><th>Demand ID</th><td>${esc0(d.id)}</td><th>Status</th><td>${status(due<=0?'Paid':'Outstanding')}</td></tr><tr><th>Tax</th><td>${money(d.tax)}</td><th>Interest</th><td>${money(d.interest)}</td></tr><tr><th>Penalty</th><td>${money(d.penalty)}</td><th>Outstanding</th><td>${money(due)}</td></tr></table>${due>0?`<div class="gst-form-grid"><div><label class="f-label">Payment Amount</label><input class="f-input" id="demPay" type="number" min="0" max="${due}" value="${due}"></div><div><label class="f-label">Payment Mode</label><select class="f-select" id="demMode"><option>Electronic Cash Ledger</option><option>DRC-03 simulated payment</option></select></div></div><button class="gst-action" onclick="gstDemandPay('${id}')">PAY / FILE DRC-03</button>`:'<div class="gst-alert success">Demand fully discharged.</div>'}`)};
  window.gstDemandPay=function(id){const x=state(),d=x.demands.find(v=>v.id===id),amt=Number(document.getElementById('demPay').value||0),due=d.tax+d.interest+d.penalty-d.paid;if(!amt||amt>due)return notify('Enter a valid payment amount');d.paid+=amt;d.status=d.paid>=(d.tax+d.interest+d.penalty)?'Paid':'Partially Paid';d.lastPayment={amount:amt,reference:ref('DRC03'),at:now()};audit(x,'Demand & Recovery','PAY / DRC-03',id,d.lastPayment.reference);save(x);gstDemandView(id)};

  function appeal(){const x=state();nav('Appeal to Appellate Authority — APL-01','Services > User Services > My Applications > Appeal',`<div class="gst-alert info">Training appeal workflow based on the portal sequence: order selection → disputed amounts → pre-deposit → supporting documents → preview → DSC/EVC → acknowledgement.</div><div class="gst-form-grid"><div><label class="f-label">Order Type *</label><select class="f-select" id="apType"><option>Demand Order</option><option>Registration Order</option><option>Refund Order</option></select></div><div><label class="f-label">Order Number *</label><input class="f-input" id="apOrder" value="SIM-ORDER-001"></div><div><label class="f-label">Disputed Tax *</label><input class="f-input" id="apTax" type="number" value="10000"></div><div><label class="f-label">Disputed Interest</label><input class="f-input" id="apInt" type="number" value="500"></div><div><label class="f-label">Disputed Penalty</label><input class="f-input" id="apPen" type="number" value="0"></div><div><label class="f-label">Pre-deposit %</label><input class="f-input" id="apPct" type="number" value="10" min="0" max="100"></div></div>${fileSimulation('apFile')}<label class="f-label"><input type="checkbox" id="apDecl"> I verify the appeal details.</label><button class="gst-action" onclick="gstAppealSubmit()">PREVIEW & PROCEED TO FILE</button><div id="apMsg"></div>`)}
  window.gstAppealSubmit=function(){const f=id=>document.getElementById(id),m=f('apMsg');if(!f('apOrder').value.trim()||!f('apDecl').checked)return m.innerHTML='<div class="gst-alert error">Order number and declaration are mandatory.</div>';const tax=Number(f('apTax').value||0),pct=Number(f('apPct').value||0),pre=tax*pct/100,x=state(),a={arn:ref('APL01'),order:f('apOrder').value.trim(),type:f('apType').value,tax,interest:Number(f('apInt').value||0),penalty:Number(f('apPen').value||0),preDeposit:pre,status:'Filed',filedAt:now()};x.appeals.push(a);audit(x,'Appeal','FILE APL-01',a.arn,'Pre-deposit '+money(pre));save(x);m.innerHTML=`<div class="gst-alert success">Appeal filed in training simulation.<br>Simulated acknowledgement: <b>${esc0(a.arn)}</b><br>Pre-deposit: <b>${money(pre)}</b></div>`}

  function appTracker(){const x=state(),rows=[];x.amendments.forEach(a=>rows.push(['Amendment',a.arn,a.status,a.filedAt]));x.cancellations.forEach(a=>rows.push(['Cancellation',a.arn,a.status,a.filedAt]));x.revocations.forEach(a=>rows.push(['Revocation',a.arn,a.status,a.filedAt]));x.luts.forEach(a=>rows.push(['LUT',a.arn,a.status,a.filedAt]));x.appeals.forEach(a=>rows.push(['Appeal',a.arn,a.status,a.filedAt]));nav('Application Tracking','Services > Track Application Status',`<div class="gst-form-grid"><div><label class="f-label">Application Type</label><select class="f-select" id="trType"><option>All</option><option>Registration</option><option>Refund</option><option>LUT</option><option>Amendment</option><option>Cancellation</option><option>Revocation</option><option>Appeal</option></select></div><div><label class="f-label">ARN / Reference</label><input class="f-input" id="trRef"></div></div><button class="gst-action" onclick="gstTrackApps()">SEARCH</button><div id="trAppOut"></div><div class="gst-note">Refund applications can also be tracked by ARN or Filing Year in the official portal workflow. citeturn1search1</div>`);document.getElementById('trAppOut').innerHTML='';window.gstTrackApps(rows)}
  window.gstTrackApps=function(rows){const q=(document.getElementById('trRef')?.value||'').trim().toLowerCase(),t=document.getElementById('trType')?.value||'All';const rr=rows.filter(r=>(!q||r[1].toLowerCase().includes(q))&&(t==='All'||r[0].toLowerCase().includes(t.toLowerCase())));const out=document.getElementById('trAppOut');if(out)out.innerHTML=`<table class="gst-table"><thead><tr><th>Application</th><th>Reference</th><th>Status</th><th>Filed</th><th>Timeline</th></tr></thead><tbody>${rr.map(r=>`<tr><td>${esc0(r[0])}</td><td>${esc0(r[1])}</td><td>${status(r[2])}</td><td>${new Date(r[3]).toLocaleString('en-IN')}</td><td><button class="gst-action secondary" onclick="notify('Timeline opened for ${esc0(r[1])}')">VIEW TIMELINE</button></td></tr>`).join('')||'<tr><td colspan="5">No applications found.</td></tr>'}</tbody></table>`}

  const oldOpen=window.openFeature;
  window.openFeature=function(t){
    const m={
      'amendment-core':()=>amendment('Core'),'amendment-noncore':()=>amendment('Non-Core'),'amendment':()=>amendment('Non-Core'),
      'registration-amendment-core':()=>amendment('Core'),'registration-amendment-noncore':()=>amendment('Non-Core'),
      'cancellation':cancellation,'registration-cancellation':cancellation,'revocation':revocation,'registration-revocation':revocation,
      'lut':lut,'furnish-lut':lut,'track-lut':()=>appTracker(),'applications':applications,'my-applications':applications,'application-tracker':appTracker,
      'notices':notices,'orders':notices,'notice':notices,'cause':notices,'additional-notices':notices,
      'communication':communication,'communication-taxpayers':communication,'taxpayer-communication':communication,
      'grievance':grievance,'payment-grievance':grievance,'gstp':gstp,'demand':demand,'recovery':demand,'appeal':appeal,'appeals':appeal,
      'track-registration':()=>appTracker(),'track-other':()=>appTracker(),'track-appeal':()=>appTracker(),'track-ruling':()=>appTracker()
    }; if(m[t])return m[t](); return oldOpen(t);
  };
  const oldNav=window.featureNav;
  window.featureNav=function(label){
    const l=String(label).toLowerCase();
    if(l.includes('amendment')&&l.includes('core'))return amendment('Core');
    if(l.includes('amendment'))return amendment('Non-Core');
    if(l.includes('cancellation'))return cancellation();
    if(l.includes('revocation'))return revocation();
    if(l==='lut'||l.includes('letter of undertaking'))return lut();
    if(l.includes('notice')||l.includes('order'))return notices();
    if(l.includes('qrmp')||l.includes('opt-in for quarterly')||l.includes('opt in for quarterly'))return (window.gstQrmpOptIn?window.gstQrmpOptIn():openReturnsDashboard());
    if(l.includes('communication'))return communication();
    if(l.includes('grievance'))return grievance();
    if(l.includes('gst practitioner'))return gstp();
    if(l.includes('demand')||l.includes('recovery'))return demand();
    if(l.includes('appeal'))return appeal();
    if(l.includes('application'))return applications();
    if(l.includes('track'))return appTracker();
    return oldNav(label);
  };
  window.gstFinalServices={state,save};
})();


/* ===== Extracted script block ===== */


/* ===== FINAL SEARCH / HELP / ADVANCE RULING SERVICES ===== */
(function(){
  const escR=window.esc||function(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))};
  function rf(t,sub,b){feature(t,sub,b)}
  window.gstVerifyRFN=function(){const v=(document.getElementById('rfnInput')?.value||'').trim(),o=document.getElementById('rfnOut');if(!v){o.innerHTML='<div class="gst-alert error">Enter an RFN / reference number.</div>';return}o.innerHTML=`<div class="gst-alert success"><b>Reference verified in training simulator.</b><br>RFN: ${escR(v)}<br>Status: Valid simulated reference.</div>`};
  window.gstRFN=function(){rf('Verify RFN','Services > User Services > Verify RFN',`<div class="gst-alert info">RFN verification is a training-only lookup. No live GSTN record is queried.</div><div class="f-card"><label class="f-label">RFN / Reference Number *</label><input class="f-input" id="rfnInput" placeholder="Enter simulated reference"><button class="gst-action" onclick="gstVerifyRFN()">SEARCH</button></div><div id="rfnOut"></div>`) };
  window.gstRuling=function(){rf('Search Advance Ruling','Services > User Services > Search Advance Ruling',`<div class="gst-form-grid"><div><label class="f-label">Ruling Number</label><input class="f-input" id="rulNo"></div><div><label class="f-label">State</label><select class="f-select" id="rulState"><option>All States</option><option>Kerala</option><option>Karnataka</option><option>Tamil Nadu</option><option>Maharashtra</option></select></div><div><label class="f-label">Keyword</label><input class="f-input" id="rulKey" placeholder="Goods / service / issue"></div></div><button class="gst-action" onclick="gstRulingSearch()">SEARCH</button><div id="rulOut"></div>`) };
  window.gstRulingSearch=function(){const n=document.getElementById('rulNo').value.trim(),k=document.getElementById('rulKey').value.trim(),s=document.getElementById('rulState').value;const rows=[['SIM-AAR-001','Kerala','Classification of training service','Demo Authority','Pronounced'],['SIM-AAR-002','Karnataka','ITC eligibility scenario','Demo Authority','Pronounced']].filter(r=>(!n||r[0].includes(n))&&(s==='All States'||r[1]===s)&&(!k||r.join(' ').toLowerCase().includes(k.toLowerCase())));document.getElementById('rulOut').innerHTML=`<table class="gst-table"><thead><tr><th>Ruling No.</th><th>State</th><th>Issue</th><th>Authority</th><th>Status</th></tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${escR(c)}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="5">No matching simulated rulings.</td></tr>'}</tbody></table>`};
  window.gstHelpdesk=function(){rf('Help Desk','Services > User Services > Help Desk',`<div class="gst-alert info"><b>GST Help Desk — Training Simulator</b></div><div class="gst-form-grid"><div><label class="f-label">Issue Category</label><select class="f-select" id="hdCat"><option>Login</option><option>Registration</option><option>Returns</option><option>Payment</option><option>Refund</option><option>e-Invoice</option><option>e-Way Bill</option><option>Technical</option></select></div><div><label class="f-label">Reference</label><input class="f-input" id="hdRef"></div></div><label class="f-label">Issue Description *</label><textarea class="f-textarea" id="hdDesc"></textarea><button class="gst-action" onclick="gstHelpSubmit()">SUBMIT QUERY</button><div id="hdOut"></div>`)};
  window.gstHelpSubmit=function(){const d=document.getElementById('hdDesc').value.trim();if(!d)return notify('Description is mandatory');document.getElementById('hdOut').innerHTML='<div class="gst-alert success"><b>Help Desk reference generated.</b><br>Simulated ticket: '+escR('HD-SIM-'+Date.now().toString().slice(-8))+'</div>'};
  const old=window.openFeature;
  window.openFeature=function(t){if(t==='rfn')return gstRFN();if(t==='ruling')return gstRuling();if(t==='helpdesk')return gstHelpdesk();return old(t)};
})();


/* ===== Extracted script block ===== */


/* FINAL MASTER ROUTING HARDENING — preserve original UI, route to the deepest existing workflow. */
(function(){
  const _fn=window.featureNav;
  window.featureNav=function(label){
    const direct={
      'GSTR-1':()=>window.gstOpenGstr1&&window.gstOpenGstr1(),
      'GSTR-2B':()=>window.gstOpenGstr2B&&window.gstOpenGstr2B(),
      'GSTR-3B':()=>window.gst3bOpen&&window.gst3bOpen(),
      'GSTR-9':()=>window.g9Open&&window.g9Open(document.getElementById('gstFY')?.value||'2025-26'),
      'GSTR-9C':()=>window.g9cOpen&&window.g9cOpen(document.getElementById('gstFY')?.value||'2025-26'),
      'IMS':()=>window.gstOpenIMS&&window.gstOpenIMS()
    };
    if(direct[label]){
      if(typeof window.gstRequireLogin==='function' && !window.gstRequireLogin(label)) return;
      return direct[label]();
    }
    return _fn(label);
  };
  const _openReturn=window.gstOpenReturn;
  window.gstOpenReturn=function(name){
    if(name==='GSTR-1' && window.gstOpenGstr1) return window.gstOpenGstr1();
    if(name==='GSTR-2B' && window.gstOpenGstr2B) return window.gstOpenGstr2B();
    if(name==='GSTR-3B' && window.gst3bOpen) return window.gst3bOpen();
    if(name==='GSTR-9' && window.g9Open) return window.g9Open(document.getElementById('gstFY')?.value||'2025-26');
    if(name==='GSTR-9C' && window.g9cOpen) return window.g9cOpen(document.getElementById('gstFY')?.value||'2025-26');
    return _openReturn(name);
  };
})();


/* ===== Extracted script block ===== */


/* FINAL MASTER ROUTING HARDENING — preserve original UI, route to the deepest existing workflow. */
(function(){
  const _fn=window.featureNav;
  window.featureNav=function(label){
    const direct={
      'GSTR-1':()=>window.gstOpenGstr1&&window.gstOpenGstr1(),
      'GSTR-2B':()=>window.gstOpenGstr2B&&window.gstOpenGstr2B(),
      'GSTR-3B':()=>window.gst3bOpen&&window.gst3bOpen(),
      'GSTR-9':()=>window.g9Open&&window.g9Open(document.getElementById('gstFY')?.value||'2025-26'),
      'GSTR-9C':()=>window.g9cOpen&&window.g9cOpen(document.getElementById('gstFY')?.value||'2025-26'),
      'IMS':()=>window.gstOpenIMS&&window.gstOpenIMS()
    };
    if(direct[label]){
      if(typeof window.gstRequireLogin==='function' && !window.gstRequireLogin(label)) return;
      return direct[label]();
    }
    return _fn(label);
  };
  const _openReturn=window.gstOpenReturn;
  window.gstOpenReturn=function(name){
    if(name==='GSTR-1' && window.gstOpenGstr1) return window.gstOpenGstr1();
    if(name==='GSTR-2B' && window.gstOpenGstr2B) return window.gstOpenGstr2B();
    if(name==='GSTR-3B' && window.gst3bOpen) return window.gst3bOpen();
    if(name==='GSTR-9' && window.g9Open) return window.g9Open(document.getElementById('gstFY')?.value||'2025-26');
    if(name==='GSTR-9C' && window.g9cOpen) return window.g9cOpen(document.getElementById('gstFY')?.value||'2025-26');
    return _openReturn(name);
  };
})();


/* ===== Extracted script block ===== */


/* ===== GSTR-1 screen fidelity pass: CDNs / HSN / Documents / Amendments / Summary ===== */
(function(){
  function g1d(){ const d=gstGstr1Data(); d.notes=d.notes||[]; d.amendments=d.amendments||[]; d.advances=d.advances||[]; d.summary=d.summary||null; return d; }
  function save1(d){gstSaveGstr1(d)}
  function freeze1(d){return d.status==='Submitted'||d.status==='Filed'}
  function statusCount(arr,st){return arr.filter(x=>(x.status||'Processed')===st).length}
  function tableCard(title,subtitle,count,action,extra=''){
    return `<div class="gst-portal-tile"><div class="portal-tile-head"><span>${title}</span><span class="portal-count">${count}</span></div><div class="portal-tile-body"><div class="portal-tile-sub">${subtitle}</div><div class="portal-tile-actions"><button class="gst-action" onclick="${action}">OPEN</button>${extra}</div></div></div>`;
  }
  window.gstGstr1Body=function(){
    const c=gstReturnContext(),d=g1d(),s=gstGstr1Summary(d), submitted=freeze1(d);
    const b2b=d.invoices||[], b2c=d.b2c||[], ex=d.exports||[], notes=d.notes||[], am=d.amendments||[], hsn=d.hsn||[], docs=d.documents||[];
    const hasSupply=b2b.length+b2c.length+ex.length>0;
    const addTiles=[
      tableCard('4A, 4B, 4C, 6B, 6C — B2B','B2B invoices / SEZ / deemed exports',b2b.length,'gstGstr1B2B()'),
      tableCard('5A, 5B — B2C Large','Inter-State supplies to unregistered persons above applicable threshold',b2c.filter(x=>x.type==='B2C Large').length,'gstGstr1B2CLarge()'),
      tableCard('6A — Exports','Export invoices with / without payment of tax',ex.filter(x=>x.type==='Export').length,'gstGstr1Exports()'),
      tableCard('7 — B2C Others','Other taxable outward supplies to unregistered persons',b2c.filter(x=>x.type==='B2C Others').length,'gstGstr1B2COthers()'),
      tableCard('8A, 8B, 8C, 8D — Nil / Exempt / Non-GST','Nil-rated, exempt and non-GST outward supplies',b2c.filter(x=>x.type==='Nil / Exempt / Non-GST').length,'gstGstr1B2CNil()'),
      tableCard('9B — Credit / Debit Notes (Registered)','CDNR — notes issued to registered recipients',notes.filter(x=>x.party==='Registered').length,'gstGstr1Notes(\'Registered\')'),
      tableCard('9B — Credit / Debit Notes (Unregistered)','CDNUR — notes to unregistered recipients / export notes',notes.filter(x=>x.party==='Unregistered').length,'gstGstr1Notes(\'Unregistered\')'),
      tableCard('11A — Advances Received','Advances on which tax is payable',d.advances.filter(x=>x.kind==='Received').length,'gstGstr1Advances(\'Received\')'),
      tableCard('11B — Adjustment of Advances','Adjustment of advances against invoices',d.advances.filter(x=>x.kind==='Adjustment').length,'gstGstr1Advances(\'Adjustment\')'),
      tableCard('12 — HSN-wise Summary','Separate B2B and B2C HSN summaries',hsn.length,'gstGstr1Hsn()'),
      tableCard('13 — Documents Issued','Document series issued during the period',docs.length,'gstGstr1Documents()'),
      tableCard('14 — Supplies through ECO','E-commerce operator supplies, where applicable',0,'gstGstr1Placeholder(\'14 — Supplies through ECO\')'),
      tableCard('15 — Supplies u/s 9(5)','Supplies covered under section 9(5), where applicable',0,'gstGstr1Placeholder(\'15 — Supplies u/s 9(5)\')')
    ].join('');
    const amendTiles=[
      tableCard('9A — Amended B2B Invoice','Amend previously reported B2B invoice',am.filter(x=>x.table==='9A-B2B').length,'gstGstr1Amend(\'9A-B2B\')'),
      tableCard('9A — Amended Export Invoice','Amend previously reported export invoice',am.filter(x=>x.table==='9A-EXP').length,'gstGstr1Amend(\'9A-EXP\')'),
      tableCard('9B — Amended CDNR / CDNRA','Amend registered credit/debit note',am.filter(x=>x.table==='9C-CDNR').length,'gstGstr1Amend(\'9C-CDNR\')'),
      tableCard('9B — Amended CDNUR','Amend unregistered/export credit/debit note',am.filter(x=>x.table==='9C-CDNUR').length,'gstGstr1Amend(\'9C-CDNUR\')'),
      tableCard('10 — Amended B2C Others','Amend previously reported B2C supply',am.filter(x=>x.table==='10-B2C').length,'gstGstr1Amend(\'10-B2C\')'),
      tableCard('11A — Amended Advances','Amend advances received',am.filter(x=>x.table==='11A').length,'gstGstr1Amend(\'11A\')'),
      tableCard('11B — Amended Advance Adjustment','Amend advance adjustment',am.filter(x=>x.table==='11B').length,'gstGstr1Amend(\'11B\')'),
      tableCard('14A — Amended ECO','Amend supplies through ECO',am.filter(x=>x.table==='14A').length,'gstGstr1Amend(\'14A\')'),
      tableCard('15A — Amended 9(5)','Amend supplies under section 9(5)',am.filter(x=>x.table==='15A').length,'gstGstr1Amend(\'15A\')')
    ].join('');
    return `<div class="gst-portal-return-head"><div><div class="portal-kicker">FORM GSTR-1</div><h2>Details of Outward Supplies of Goods or Services</h2><div class="portal-meta"><span>Financial Year: <b>${esc(c.fy)}</b></span><span>Return Period: <b>${esc(c.period)}</b></span><span>GSTIN: <b>${esc(gstRead('gstTaxpayer',GST_DEMO).gstin)}</b></span><span>Status: <b>${esc(d.status)}</b></span></div></div><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK TO RETURNS DASHBOARD</button></div>
      <div class="gst-alert info"><b>GSTR-1 / IFF</b><br>Enter details under ADD RECORD DETAILS. Previously reported details can be corrected under AMEND RECORD DETAILS. This training simulator uses demo data only.</div>
      <div class="gst-section-title">ADD RECORD DETAILS <span class="portal-section-note">${s.count} outward document(s)</span></div>
      <div class="gst-portal-grid">${addTiles}</div>
      <div class="gst-section-title portal-collapsible" onclick="gstToggleAmend()">AMEND RECORD DETAILS <span id="g1AmendArrow">▼</span></div>
      <div id="g1AmendPanel" class="gst-portal-grid" style="display:none">${amendTiles}</div>
      <div class="gst-section-title">Return Summary</div>
      <table class="gst-table gst-portal-table"><thead><tr><th>Particulars</th><th>Records</th><th>Taxable Value</th><th>IGST</th><th>CGST</th><th>SGST/UTGST</th></tr></thead><tbody>
      <tr><td>Outward Supplies</td><td>${s.count}</td><td>${gstMoney(s.taxable)}</td><td>${gstMoney(s.igst)}</td><td>${gstMoney(s.cgst)}</td><td>${gstMoney(s.sgst)}</td></tr>
      <tr><td>Credit / Debit Notes</td><td>${notes.length}</td><td>${gstMoney(notes.reduce((a,x)=>a+(+x.taxable||0),0))}</td><td>${gstMoney(notes.reduce((a,x)=>a+(+x.igst||0),0))}</td><td>${gstMoney(notes.reduce((a,x)=>a+(+x.cgst||0),0))}</td><td>${gstMoney(notes.reduce((a,x)=>a+(+x.sgst||0),0))}</td></tr>
      <tr><td>HSN / SAC</td><td>${hsn.length}</td><td colspan="4">${hsn.length?'Details entered':'Not yet entered'}</td></tr>
      <tr><td>Documents Issued</td><td>${docs.length}</td><td colspan="4">${docs.length?'Details entered':'Not yet entered'}</td></tr></tbody></table>
      <div class="gst-section-title">GSTR-1 Actions</div>
      <div class="gst-alert ${submitted?'success':'warning'}">${submitted?'<b>Return submitted.</b> The return is frozen for this period.':'<b>Before filing:</b> generate the summary, preview the return, validate all applicable tables and then submit.'}</div>
      <div class="gst-action-row"><button class="gst-action" onclick="gstGstr1GenerateSummary()" ${submitted?'disabled':''}>GENERATE GSTR-1 SUMMARY</button><button class="gst-action secondary" onclick="gstGstr1Preview()">PREVIEW</button><button class="gst-action" onclick="gstGstr1Validate()" ${submitted?'disabled':''}>VALIDATE</button><button class="gst-action" onclick="gstGstr1Submit()" ${submitted?'disabled':''}>SUBMIT</button></div><div id="gstGstr1Msg" class="demo-note"></div>`;
  };
  window.gstToggleAmend=function(){const e=document.getElementById('g1AmendPanel'),a=document.getElementById('g1AmendArrow');if(!e)return;e.style.display=e.style.display==='none'?'grid':'none';if(a)a.textContent=e.style.display==='none'?'▼':'▲'};
  window.gstGstr1Placeholder=function(name){feature('GSTR-1 — '+name,'GSTR-1 > ADD RECORD DETAILS > '+name,`<div class="gst-alert info"><b>${esc(name)}</b><br>This applicable-table workspace is available in the training simulator. Add only when the taxpayer scenario requires it.</div><div class="gst-form-grid"><div><label>Nature of Supply *</label><select id="g1pNature" class="f-select"><option>Applicable supply</option><option>Not applicable</option></select></div><div><label>Taxable Value</label><input id="g1pTax" type="number" min="0" class="f-input"></div><div><label>IGST</label><input id="g1pI" type="number" min="0" class="f-input"></div><div><label>CGST</label><input id="g1pC" type="number" min="0" class="f-input"></div><div><label>SGST/UTGST</label><input id="g1pS" type="number" min="0" class="f-input"></div><div><label>Cess</label><input id="g1pCe" type="number" min="0" class="f-input"></div></div><div class="gst-action-row"><button class="gst-action" onclick="gstGstr1PlaceholderSave('${esc(name)}')">SAVE</button><button class="gst-action secondary" onclick="gstOpenGstr1()">BACK</button></div><div id="g1pMsg" class="demo-note"></div>`)};
  window.gstGstr1PlaceholderSave=function(name){const m=document.getElementById('g1pMsg');m.innerHTML='<span style="color:#176b35"><b>Save request is accepted successfully.</b> This table is retained as a simulated applicable-table entry for the selected period.</span>';};
  window.gstGstr1Notes=function(party){const d=g1d(),arr=d.notes.filter(x=>x.party===party),rows=arr.map((x,i)=>`<tr><td>${esc(x.noteType)}</td><td>${esc(x.noteNo)}</td><td>${esc(x.noteDate)}</td><td>${esc(x.recipient||'—')}</td><td>${gstMoney(x.taxable)}</td><td>${gstMoney(x.igst)}</td><td>${gstMoney(x.cgst)}</td><td>${gstMoney(x.sgst)}</td><td><button class="gst-action secondary" onclick="gstGstr1NoteDelete('${esc(party)}',${i})">DELETE</button></td></tr>`).join('')||`<tr><td colspan="9">No ${party.toLowerCase()} credit/debit notes entered.</td></tr>`;
    feature('GSTR-1 — Credit / Debit Notes',`GSTR-1 > ADD RECORD DETAILS > 9B > ${party}`,`<div class="gst-pagebar"><div><b>9B — Credit / Debit Notes (${esc(party)})</b><div class="muted">Add notes issued during the selected return period.</div></div><button class="gst-action secondary" onclick="gstOpenGstr1()">BACK</button></div><div class="gst-form-grid"><div><label>Note Type *</label><select id="g1nType" class="f-select"><option>Credit Note</option><option>Debit Note</option></select></div><div><label>Note Number *</label><input id="g1nNo" class="f-input"></div><div><label>Note Date *</label><input id="g1nDate" type="date" class="f-input"></div><div><label>${party==='Registered'?'Recipient GSTIN':'Recipient / UR Type'}</label><input id="g1nRecipient" class="f-input" placeholder="${party==='Registered'?'15-character GSTIN':'Recipient / Export type'}"></div><div><label>Original Invoice / Note Reference</label><input id="g1nOrig" class="f-input"></div><div><label>Place of Supply</label><select id="g1nPos" class="f-select"><option>Kerala</option><option>Inter-State</option></select></div><div><label>Taxable Value *</label><input id="g1nTax" type="number" min="0" step="0.01" class="f-input"></div><div><label>Tax Rate *</label><select id="g1nRate" class="f-select"><option>5</option><option selected>18</option><option>40</option></select></div><div><label>Cess</label><input id="g1nCess" type="number" min="0" class="f-input" value="0"></div></div><div class="gst-action-row"><button class="gst-action" onclick="gstGstr1NoteAdd('${esc(party)}')">SAVE</button><button class="gst-action secondary" onclick="gstOpenGstr1()">BACK</button></div><div id="g1nMsg" class="demo-note"></div><div class="gst-section-title">Added Note Details</div><table class="gst-table gst-portal-table"><thead><tr><th>Type</th><th>Note No.</th><th>Date</th><th>Recipient</th><th>Taxable</th><th>IGST</th><th>CGST</th><th>SGST</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>`)};
  window.gstGstr1NoteAdd=function(party){const d=g1d(),m=document.getElementById('g1nMsg');if(freeze1(d)){m.innerHTML='<span style="color:#9a2f2f">Return is frozen after submission.</span>';return}const v={party,noteType:document.getElementById('g1nType').value,noteNo:document.getElementById('g1nNo').value.trim(),noteDate:document.getElementById('g1nDate').value,recipient:document.getElementById('g1nRecipient').value.trim().toUpperCase(),original:document.getElementById('g1nOrig').value.trim(),pos:document.getElementById('g1nPos').value,taxable:+document.getElementById('g1nTax').value||0,rate:+document.getElementById('g1nRate').value,cess:+document.getElementById('g1nCess').value||0};if(!v.noteNo||!v.noteDate||v.taxable<=0){m.innerHTML='<span style="color:#9a2f2f">Note number, date and taxable value are mandatory.</span>';return}if(d.notes.some(x=>x.party===party&&x.noteNo.toUpperCase()===v.noteNo.toUpperCase()&&x.noteDate===v.noteDate)){m.innerHTML='<span style="color:#9a2f2f">Duplicate note detected for this period.</span>';return}const tax=gstTaxCalc(v.taxable,v.rate,v.pos);v.igst=tax.igst;v.cgst=tax.cgst;v.sgst=tax.sgst;d.notes.push(v);save1(d);gstGstr1Notes(party);};
  window.gstGstr1NoteDelete=function(party,i){const d=g1d(),arr=d.notes.filter(x=>x.party===party),target=arr[i];if(!target)return;const idx=d.notes.indexOf(target);d.notes.splice(idx,1);save1(d);gstGstr1Notes(party)};
  window.gstGstr1Advances=function(kind){const d=g1d(),arr=d.advances.filter(x=>x.kind===kind);feature('GSTR-1 — '+(kind==='Received'?'11A Advances Received':'11B Adjustment of Advances'),'GSTR-1 > '+(kind==='Received'?'11A':'11B'),`<div class="gst-alert info">Enter ${kind==='Received'?'advances received on which tax is payable':'adjustments of advances against invoices'} for the selected period.</div><div class="gst-form-grid"><div><label>Reference *</label><input id="g1aRef" class="f-input"></div><div><label>Date *</label><input id="g1aDate" type="date" class="f-input"></div><div><label>Place of Supply</label><select id="g1aPos" class="f-select"><option>Kerala</option><option>Inter-State</option></select></div><div><label>Taxable Value *</label><input id="g1aTax" type="number" min="0" class="f-input"></div><div><label>Tax Rate *</label><select id="g1aRate" class="f-select"><option>5</option><option selected>18</option><option>40</option></select></div></div><div class="gst-action-row"><button class="gst-action" onclick="gstGstr1AdvanceAdd('${kind}')">SAVE</button><button class="gst-action secondary" onclick="gstOpenGstr1()">BACK</button></div><div id="g1aMsg" class="demo-note"></div><table class="gst-table"><thead><tr><th>Reference</th><th>Date</th><th>POS</th><th>Taxable</th><th>IGST</th><th>CGST</th><th>SGST</th></tr></thead><tbody>${arr.map(x=>`<tr><td>${esc(x.ref)}</td><td>${esc(x.date)}</td><td>${esc(x.pos)}</td><td>${gstMoney(x.taxable)}</td><td>${gstMoney(x.igst)}</td><td>${gstMoney(x.cgst)}</td><td>${gstMoney(x.sgst)}</td></tr>`).join('')||'<tr><td colspan="7">No records.</td></tr>'}</tbody></table>`)};
  window.gstGstr1AdvanceAdd=function(kind){const d=g1d(),m=document.getElementById('g1aMsg'),v={kind,ref:document.getElementById('g1aRef').value.trim(),date:document.getElementById('g1aDate').value,pos:document.getElementById('g1aPos').value,taxable:+document.getElementById('g1aTax').value||0,rate:+document.getElementById('g1aRate').value};if(freeze1(d)){m.innerHTML='<span style="color:#9a2f2f">Return is frozen after submission.</span>';return}if(!v.ref||!v.date||v.taxable<=0){m.innerHTML='<span style="color:#9a2f2f">Reference, date and taxable value are mandatory.</span>';return}Object.assign(v,gstTaxCalc(v.taxable,v.rate,v.pos));d.advances.push(v);save1(d);gstGstr1Advances(kind)};
  window.gstGstr1Amend=function(table){const d=g1d(),source=table==='9A-B2B'?d.invoices:table==='9A-EXP'?d.exports:table==='10-B2C'?d.b2c:table==='9C-CDNR'||table==='9C-CDNUR'?d.notes:[];const options=source.map((x,i)=>`<option value="${i}">${esc(x.invoiceNo||x.noteNo||x.ref||('Record '+(i+1)))} — ${esc(x.invoiceDate||x.noteDate||x.date||'')}</option>`).join('');feature('GSTR-1 — Amend Record Details','GSTR-1 > AMEND RECORD DETAILS > '+table,`<div class="gst-alert info"><b>${esc(table)}</b><br>Select a previously reported record and enter the corrected values. Amendment records remain separate from the original record in this training simulator.</div><div class="gst-form-grid"><div><label>Original Record *</label><select id="g1amSource" class="f-select">${options||'<option value="">No eligible records found</option>'}</select></div><div><label>Original Financial Year *</label><input id="g1amFY" class="f-input" value="${esc(gstReturnContext().fy)}"></div><div><label>Original Return Period *</label><input id="g1amPeriod" class="f-input" value="${esc(gstReturnContext().period)}"></div><div><label>Amendment Reason *</label><input id="g1amReason" class="f-input" placeholder="Reason for amendment"></div><div><label>Revised Taxable Value *</label><input id="g1amTax" type="number" min="0" class="f-input"></div><div><label>Revised Tax Rate *</label><select id="g1amRate" class="f-select"><option>5</option><option selected>18</option><option>40</option></select></div><div><label>Place of Supply</label><select id="g1amPos" class="f-select"><option>Kerala</option><option>Inter-State</option></select></div></div><div class="gst-action-row"><button class="gst-action" onclick="gstGstr1AmendSave('${esc(table)}')">SAVE AMENDMENT</button><button class="gst-action secondary" onclick="gstOpenGstr1()">BACK</button></div><div id="g1amMsg" class="demo-note"></div><div class="gst-section-title">Amendment History</div><table class="gst-table"><thead><tr><th>Table</th><th>Original</th><th>Reason</th><th>Revised Taxable</th><th>Date</th></tr></thead><tbody>${d.amendments.filter(x=>x.table===table).map(x=>`<tr><td>${esc(x.table)}</td><td>${esc(x.original)}</td><td>${esc(x.reason)}</td><td>${gstMoney(x.taxable)}</td><td>${esc(x.createdAt.slice(0,10))}</td></tr>`).join('')||'<tr><td colspan="5">No amendments saved.</td></tr>'}</tbody></table>`)};
  window.gstGstr1AmendSave=function(table){const d=g1d(),m=document.getElementById('g1amMsg');if(freeze1(d)){m.innerHTML='<span style="color:#9a2f2f">Return is frozen after submission.</span>';return}const sel=document.getElementById('g1amSource'),v={table,original:sel?.selectedOptions?.[0]?.text||'',reason:document.getElementById('g1amReason').value.trim(),fy:document.getElementById('g1amFY').value,period:document.getElementById('g1amPeriod').value,taxable:+document.getElementById('g1amTax').value||0,rate:+document.getElementById('g1amRate').value,pos:document.getElementById('g1amPos').value,createdAt:new Date().toISOString()};if(!v.reason||v.taxable<0||!v.original){m.innerHTML='<span style="color:#9a2f2f">Select an original record and enter amendment reason and revised taxable value.</span>';return}Object.assign(v,gstTaxCalc(v.taxable,v.rate,v.pos));d.amendments.push(v);save1(d);m.innerHTML='<span style="color:#176b35"><b>Save request is accepted successfully.</b> Amendment added to the current return.</span>';setTimeout(()=>gstGstr1Amend(table),250)};
  window.gstGstr1Preview=function(){const d=g1d(),s=gstGstr1Summary(d);feature('GSTR-1 — Preview','GSTR-1 > Preview',`<div class="gst-alert info">Preview of the current GSTR-1 return. This is a simulated training document and is not a government filing.</div><div class="gst-section-title">Return Summary</div><table class="gst-table gst-portal-table"><thead><tr><th>Particulars</th><th>Value</th></tr></thead><tbody><tr><td>Total outward documents</td><td>${s.count}</td></tr><tr><td>Total taxable value</td><td>${gstMoney(s.taxable)}</td></tr><tr><td>IGST</td><td>${gstMoney(s.igst)}</td></tr><tr><td>CGST</td><td>${gstMoney(s.cgst)}</td></tr><tr><td>SGST/UTGST</td><td>${gstMoney(s.sgst)}</td></tr><tr><td>Credit/Debit Notes</td><td>${d.notes.length}</td></tr><tr><td>HSN records</td><td>${d.hsn.length}</td></tr><tr><td>Documents issued</td><td>${d.documents.length}</td></tr></tbody></table><div class="gst-section-title">Table Completion Check</div><table class="gst-table"><tr><th>Table</th><th>Status</th></tr><tr><td>12 — HSN</td><td>${d.hsn.length?'Entered':'Review required'}</td></tr><tr><td>13 — Documents Issued</td><td>${(d.documents.length||!s.count)?'Entered / Not applicable':'Required before filing when outward supplies are reported'}</td></tr></table><div class="gst-action-row"><button class="gst-action secondary" onclick="gstOpenGstr1()">BACK TO GSTR-1</button></div>`)};
  window.gstGstr1Validate=function(){const d=g1d(),m=document.getElementById('gstGstr1Msg'),errors=[];for(const x of d.invoices){if(!x.invoiceNo)errors.push('B2B invoice number missing');if(!x.recipientGstin)errors.push('Recipient GSTIN missing');if((+x.taxable||0)<=0)errors.push('B2B taxable value must be greater than zero')}for(const x of d.notes){if(!x.noteNo||!x.noteDate||(+x.taxable||0)<=0)errors.push('Credit/Debit Note contains incomplete mandatory details')}if(d.hsn.length===0&&d.invoices.length+d.b2c.length+d.exports.length>0)errors.push('Table 12 HSN/SAC details require review');if(d.documents.length===0&&d.invoices.length+d.b2c.length+d.exports.length>0)errors.push('Table 13 Documents Issued is mandatory when applicable supplies are reported from May 2025 onward');if(errors.length){m.innerHTML='<span style="color:#9a2f2f"><b>Validation failed.</b><ul>'+errors.map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul></span>';return false}d.status='Validated';d.validatedAt=new Date().toISOString();save1(d);m.innerHTML='<span style="color:#176b35"><b>Validation successful.</b> GSTR-1 is ready for summary / preview / submission.</span>';return true};
  window.gstGstr1GenerateSummary=function(){const d=g1d(),s=gstGstr1Summary(d);d.summary=s;d.summaryGeneratedAt=new Date().toISOString();save1(d);const m=document.getElementById('gstGstr1Msg');if(m)m.innerHTML='<span style="color:#176b35"><b>Save request is accepted successfully.</b><br>GSTR-1 summary generated. '+s.count+' outward document(s); taxable value '+gstMoney(s.taxable)+'.</span>'};
})();


/* ===== Extracted script block ===== */


/* ===== GSTR-1 fidelity completion: exact sub-screen behavior ===== */
(function(){
  window.gstGstr1B2CLarge=function(){gstGstr1B2CAddForm&&gstGstr1B2C('B2C Large')};
  window.gstGstr1B2COthers=function(){gstGstr1B2CAddForm&&gstGstr1B2C('B2C Others')};
  window.gstGstr1B2CNil=function(){gstGstr1B2CAddForm&&gstGstr1B2C('Nil / Exempt / Non-GST')};
  /* Preserve existing B2C page while routing the new tiles to the correct variants. */
  const oldB2C=window.gstGstr1B2C;
  window.gstGstr1B2C=function(type){
    if(typeof type==='string'){
      const d=gstGstr1Data(), arr=(d.b2c||[]).filter(x=>x.type===type);
      const label=type==='B2C Large'?'5A, 5B — B2C Large':type==='B2C Others'?'7 — B2C Others':'8A, 8B, 8C, 8D — Nil / Exempt / Non-GST';
      const add=type==='B2C Large'?'gstGstr1B2CLargeAdd()':type==='B2C Others'?'gstGstr1B2COthersAdd()':'gstGstr1B2CNilAdd()';
      const rows=arr.map((x,i)=>`<tr><td>${esc(x.ref||x.invoiceNo||'')}</td><td>${esc(x.date||'')}</td><td>${esc(x.pos||'')}</td><td>${gstMoney(x.invoiceValue||0)}</td><td>${gstMoney(x.taxable||0)}</td><td>${gstMoney((+x.igst||0)+(+x.cgst||0)+(+x.sgst||0))}</td><td><button class="gst-action secondary" onclick="gstDeleteGstr1B2C(${(d.b2c||[]).indexOf(x)})">DELETE</button></td></tr>`).join('')||'<tr><td colspan="7">No records found.</td></tr>';
      feature('GSTR-1 — '+label,'GSTR-1 > ADD RECORD DETAILS > '+label,`<div class="gst-pagebar"><div><b>${label}</b><div class="muted">Summary of records for the selected return period</div></div><button class="gst-action secondary" onclick="gstOpenGstr1()">BACK</button></div><div class="gst-toolbar"><button class="gst-action" onclick="${add}">ADD RECORD</button><span class="muted">Records: ${arr.length}</span></div><table class="gst-table gst-portal-table"><thead><tr><th>Invoice / Reference</th><th>Date</th><th>Place of Supply</th><th>Invoice Value</th><th>Taxable Value</th><th>Total Tax</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>`);
      return;
    }
    return oldB2C();
  };
  window.gstGstr1Hsn=function(){
    const d=gstGstr1Data(); d.hsn=d.hsn||[]; d.hsnB2B=d.hsnB2B||[]; d.hsnB2C=d.hsnB2C||[];
    const tab=(window.__g1HsnTab||'B2B'); const list=tab==='B2B'?d.hsnB2B:d.hsnB2C;
    const rows=list.map((x,i)=>`<tr><td>${esc(x.product||'')}</td><td>${esc(x.hsn||x.code||'')}</td><td>${esc(x.desc||'')}</td><td>${esc(x.uqc||'')}</td><td>${x.qty}</td><td>${gstMoney(x.taxable)}</td><td>${x.rate}%</td><td>${gstMoney(x.igst)}</td><td>${gstMoney(x.cgst)}</td><td>${gstMoney(x.sgst)}</td><td>${gstMoney(x.cess)}</td><td><button class="gst-action secondary" onclick="gstGstr1HsnDelete('${tab}',${i})">DELETE</button></td></tr>`).join('')||'<tr><td colspan="12">No HSN details entered.</td></tr>';
    feature('GSTR-1 — Table 12 HSN-wise Summary','GSTR-1 > ADD RECORD DETAILS > 12 — HSN-wise Summary',`<div class="gst-pagebar"><div><b>12 — HSN-wise Summary of Outward Supplies</b><div class="muted">Enter HSN details separately for B2B Supplies and B2C Supplies.</div></div><button class="gst-action secondary" onclick="gstOpenGstr1()">BACK</button></div><div class="gst-alert info">Current GSTN Table 12 enhancement provides separate <b>B2B Supplies</b> and <b>B2C Supplies</b> tabs and a <b>Download HSN Codes List</b> facility.</div><div class="gst-tabbar"><button class="gst-tab ${tab==='B2B'?'active':''}" onclick="window.__g1HsnTab='B2B';gstGstr1Hsn()">B2B Supplies</button><button class="gst-tab ${tab==='B2C'?'active':''}" onclick="window.__g1HsnTab='B2C';gstGstr1Hsn()">B2C Supplies</button><button class="gst-tab" onclick="gstGstr1DownloadHsn()">DOWNLOAD HSN CODES LIST</button></div><div class="gst-section-title">${tab} Supplies — Add HSN Details</div><div class="gst-form-grid"><div><label>Product Name as in My HSN Master</label><input id="g1hProduct" class="f-input" placeholder="Optional searchable master description"></div><div><label>HSN / SAC *</label><input id="g1hCode" class="f-input" maxlength="8"></div><div><label>Description</label><input id="g1hDesc" class="f-input"></div><div><label>UQC *</label><select id="g1hUqc" class="f-select"><option>PCS</option><option>NOS</option><option>KGS</option><option>LTR</option><option>OTH-Others</option></select></div><div><label>Total Quantity *</label><input id="g1hQty" type="number" min="0" class="f-input" value="0"></div><div><label>Taxable Value *</label><input id="g1hTaxable" type="number" min="0" step="0.01" class="f-input"></div><div><label>Rate of Tax *</label><select id="g1hRate" class="f-select"><option>0</option><option>5</option><option selected>18</option><option>40</option></select></div><div><label>IGST</label><input id="g1hIgst" type="number" min="0" class="f-input" value="0"></div><div><label>CGST</label><input id="g1hCgst" type="number" min="0" class="f-input" value="0"></div><div><label>SGST/UTGST</label><input id="g1hSgst" type="number" min="0" class="f-input" value="0"></div><div><label>CESS</label><input id="g1hCess" type="number" min="0" class="f-input" value="0"></div></div><div class="gst-action-row"><button class="gst-action" onclick="gstGstr1HsnAdd('${tab}')">ADD</button><button class="gst-action secondary" onclick="gstOpenGstr1()">BACK</button></div><div id="gstHsnMsg" class="demo-note"></div><div class="gst-section-title">Added HSN Details</div><div style="overflow:auto"><table class="gst-table gst-portal-table"><thead><tr><th>Product</th><th>HSN/SAC</th><th>Description</th><th>UQC</th><th>Quantity</th><th>Taxable</th><th>Rate</th><th>IGST</th><th>CGST</th><th>SGST</th><th>CESS</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>`);
  };
  window.gstGstr1HsnAdd=function(tab){const d=gstGstr1Data();d.hsn=d.hsn||[];d.hsnB2B=d.hsnB2B||[];d.hsnB2C=d.hsnB2C||[];const list=tab==='B2B'?d.hsnB2B:d.hsnB2C,m=document.getElementById('gstHsnMsg');const v={product:document.getElementById('g1hProduct').value.trim(),hsn:document.getElementById('g1hCode').value.trim(),code:document.getElementById('g1hCode').value.trim(),desc:document.getElementById('g1hDesc').value.trim(),uqc:document.getElementById('g1hUqc').value,qty:+document.getElementById('g1hQty').value||0,taxable:+document.getElementById('g1hTaxable').value||0,rate:+document.getElementById('g1hRate').value,igst:+document.getElementById('g1hIgst').value||0,cgst:+document.getElementById('g1hCgst').value||0,sgst:+document.getElementById('g1hSgst').value||0,cess:+document.getElementById('g1hCess').value||0};if(d.status!=='Draft'){m.innerHTML='<span style="color:#9a2f2f">Return is frozen after submission.</span>';return}if(!v.hsn||v.taxable<0){m.innerHTML='<span style="color:#9a2f2f">HSN/SAC and taxable value are mandatory.</span>';return}if(list.some(x=>x.hsn===v.hsn&&x.rate===v.rate&&x.uqc===v.uqc)){m.innerHTML='<span style="color:#9a2f2f">Duplicate HSN/SAC entry detected.</span>';return}const total=v.igst+v.cgst+v.sgst+v.cess;if(Math.abs(total-(v.taxable*v.rate/100))>10){m.innerHTML='<span style="color:#9a2f2f">Reported tax amount is beyond the ₹10 tolerance.</span>';return}list.push(v);d.hsn=[...d.hsnB2B,...d.hsnB2C];gstSaveGstr1(d);gstGstr1Hsn()};
  window.gstGstr1HsnDelete=function(tab,i){const d=gstGstr1Data();d.hsnB2B=d.hsnB2B||[];d.hsnB2C=d.hsnB2C||[];const list=tab==='B2B'?d.hsnB2B:d.hsnB2C;list.splice(i,1);d.hsn=[...d.hsnB2B,...d.hsnB2C];gstSaveGstr1(d);gstGstr1Hsn()};
  window.gstGstr1DownloadHsn=function(){const rows=['HSN/SAC,Description,Category','0101,Live animals,B2B','0102,Animals,B2C','9983,Other services,B2B','9985,Support services,B2C'];const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'}));a.download='simulated-updated-hsn-sac-list.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
  window.gstGstr1Documents=function(){const d=gstGstr1Data();d.documents=d.documents||[];const rows=d.documents.map((x,i)=>`<tr><td>${esc(x.type)}</td><td>${esc(x.from)}</td><td>${esc(x.to)}</td><td>${x.total}</td><td>${x.cancelled}</td><td>${Math.max(0,(+x.total||0)-(+x.cancelled||0))}</td><td><button class="gst-action secondary" onclick="gstGstr1DocDelete(${i})">DELETE</button></td></tr>`).join('')||'<tr><td colspan="7">No document series entered.</td></tr>';feature('GSTR-1 — Table 13 Documents Issued','GSTR-1 > ADD RECORD DETAILS > 13 — Documents Issued',`<div class="gst-pagebar"><div><b>13 — Documents Issued</b><div class="muted">Document series and documents issued during the return period</div></div><button class="gst-action secondary" onclick="gstOpenGstr1()">BACK</button></div><div class="gst-alert info">From May 2025 return period, Table 13 is mandatory where applicable supplies are reported. Enter the series and cancelled documents for each document type.</div><div class="gst-form-grid"><div><label>Nature of Document *</label><select id="g1dType" class="f-select"><option>Invoices for outward supply</option><option>Invoices for inward supply from unregistered persons</option><option>Debit Note</option><option>Credit Note</option><option>Receipt Voucher</option><option>Payment Voucher</option><option>Refund Voucher</option><option>Delivery Challan</option><option>Others</option></select></div><div><label>Sr. No. From *</label><input id="g1dFrom" class="f-input"></div><div><label>Sr. No. To *</label><input id="g1dTo" class="f-input"></div><div><label>Total Number *</label><input id="g1dTotal" type="number" min="0" class="f-input"></div><div><label>Cancelled</label><input id="g1dCancel" type="number" min="0" value="0" class="f-input"></div></div><div class="gst-action-row"><button class="gst-action" onclick="gstGstr1DocAdd()">SAVE</button><button class="gst-action secondary" onclick="gstOpenGstr1()">BACK</button></div><div id="gstDocMsg" class="demo-note"></div><div class="gst-section-title">Document Details</div><table class="gst-table gst-portal-table"><thead><tr><th>Nature of Document</th><th>Sr. No. From</th><th>Sr. No. To</th><th>Total Number</th><th>Cancelled</th><th>Net Issued</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>`)};
  window.gstGstr1DocAdd=function(){const d=gstGstr1Data(),m=document.getElementById('gstDocMsg'),v={type:document.getElementById('g1dType').value,from:document.getElementById('g1dFrom').value.trim(),to:document.getElementById('g1dTo').value.trim(),total:+document.getElementById('g1dTotal').value||0,cancelled:+document.getElementById('g1dCancel').value||0};if(d.status!=='Draft'){m.innerHTML='<span style="color:#9a2f2f">Return is frozen after submission.</span>';return}if(!v.from||!v.to||v.total<=0||v.cancelled<0||v.cancelled>v.total){m.innerHTML='<span style="color:#9a2f2f">Enter valid document-series details.</span>';return}d.documents=d.documents||[];d.documents.push(v);gstSaveGstr1(d);gstGstr1Documents()};
  window.gstGstr1DocDelete=function(i){const d=gstGstr1Data();if(d.status!=='Draft'){notify('Submitted return records cannot be deleted');return}d.documents.splice(i,1);gstSaveGstr1(d);gstGstr1Documents()};
})();


/* ===== Extracted script block ===== */


/* ===== IMS 95% screen-fidelity override ===== */
function imsFidelityEscape(v){return esc(v==null?'':v)}
function imsFidelityFilterLabel(f){return f==='All'?'All Documents':f}
function imsFidelityStatusClass(a){return a==='Accept'?'green':a==='Reject'?'orange':a==='Pending'?'blue':''}
function imsFidelityActionAllowed(x,a){
  const t=String(x.type||'');
  const isImport=x.source==='Import of Goods' || /^IMPG/.test(t);
  if(isImport) return ['No Action','Accept','Pending'].includes(a);
  if(t==='Credit Note' && a==='Pending' && String(x.noteOrigin||'Original').toLowerCase()==='original') return false;
  return ['No Action','Accept','Reject','Pending'].includes(a);
}
function imsFidelityNeedsReduction(x){
  return !/Import of Goods/.test(String(x.source||'')) && x.itcEligible!==false && (x.action==='Accept');
}
function imsFidelityActionOptions(x){
  const vals=x.source==='Import of Goods'?['No Action','Accept','Pending']:['No Action','Accept','Reject','Pending'];
  return vals.map(a=>`<option value="${imsFidelityEscape(a)}" ${x.action===a?'selected':''}>${imsFidelityEscape(a)}</option>`).join('')
}
function imsFidelityCounts(records){
  const z={all:0,accept:0,reject:0,pending:0,noaction:0,b2b:0,notes:0,imports:0};
  (records||[]).forEach(x=>{z.all++;const a=x.action||'No Action';if(a==='Accept')z.accept++;if(a==='Reject')z.reject++;if(a==='Pending')z.pending++;if(a==='No Action')z.noaction++;if(x.type==='B2B Invoice')z.b2b++;if(/Credit|Debit/.test(x.type||''))z.notes++;if(x.source==='Import of Goods')z.imports++});return z;
}
function imsFidelityBuildBody(d,filter='All',page=1){
  const ctx=gstReturnContext(), all=d.records||[], c=imsFidelityCounts(all), q=(document.getElementById('imsFSearch')?.value||'').trim().toLowerCase(), statusFilter=filter;
  let recs=all.filter(x=>{
    if(statusFilter==='B2B' && x.type!=='B2B Invoice')return false;
    if(statusFilter==='Credit/Debit Notes' && !/Credit|Debit/.test(x.type||''))return false;
    if(statusFilter==='Imports of Goods' && x.source!=='Import of Goods')return false;
    if(['Accepted','Rejected','Pending','No Action'].includes(statusFilter) && x.action!==statusFilter.replace('Accepted','Accept').replace('Rejected','Reject'))return false;
    if(q && ![x.supplierGstin,x.supplierName,x.invoiceNo,x.type,x.source].some(v=>String(v||'').toLowerCase().includes(q)))return false;
    return true;
  });
  const pageSize=10,totalPages=Math.max(1,Math.ceil(recs.length/pageSize)),pg=Math.min(Math.max(1,page),totalPages),slice=recs.slice((pg-1)*pageSize,pg*pageSize);
  const rows=slice.map((x,i)=>{
    const tax=(+x.igst||0)+(+x.cgst||0)+(+x.sgst||0), status=imsFidelityStatusClass(x.action);
    const canReject=x.source!=='Import of Goods';
    return `<tr>
      <td><input type="checkbox" class="ims-row-check" data-id="${imsFidelityEscape(x.id)}"></td>
      <td><b>${imsFidelityEscape(x.supplierGstin)}</b><br><span class="ims-small">${imsFidelityEscape(x.supplierName)}</span></td>
      <td><b>${imsFidelityEscape(x.invoiceNo)}</b><br><span class="ims-small">${imsFidelityEscape(x.invoiceDate)}</span></td>
      <td>${imsFidelityEscape(x.type)}<br><span class="ims-small">${imsFidelityEscape(x.source)}</span></td>
      <td>${gstMoney(x.taxable)}</td><td>${gstMoney(tax)}</td>
      <td><span class="gst-status ${status}">${imsFidelityEscape(x.action||'No Action')}</span></td>
      <td class="ims-action-cell">
        <select id="imsAct_${imsFidelityEscape(x.id)}" onchange="imsFidelityActionChanged('${imsFidelityEscape(x.id)}')">${imsFidelityActionOptions(x)}</select>
        <div id="imsReduceWrap_${imsFidelityEscape(x.id)}" style="display:${x.action==='Accept'&&x.itcReduction?'block':'none'}">
          <select id="imsReduceChoice_${imsFidelityEscape(x.id)}" onchange="imsFidelityReductionChoice('${imsFidelityEscape(x.id)}')"><option value="NO">ITC reduction: No</option><option value="YES" ${x.itcReduction>0?'selected':''}>ITC reduction: Yes</option></select>
          <input id="imsRed_${imsFidelityEscape(x.id)}" type="number" min="0" step="0.01" value="${Number(x.itcReduction||0)}" placeholder="Partial ITC reduction">
        </div>
        <input id="imsRemark_${imsFidelityEscape(x.id)}" value="${imsFidelityEscape(x.remark||'')}" maxlength="200" placeholder="Remark (required for Reject/Pending)">
        <button class="ims-btn" style="margin-top:5px" onclick="imsFidelitySaveOne('${imsFidelityEscape(x.id)}')">SAVE</button>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="8" style="text-align:center;padding:22px">No records found for the selected IMS view.</td></tr>`;
  const tabs=['All','B2B','Credit/Debit Notes','Imports of Goods','Accepted','Rejected','Pending','No Action'];
  return `<div class="ims-page">
    <div class="ims-head">Invoice Management System (IMS)</div>
    <div class="ims-subhead"><b>Services &gt; Returns &gt; Invoice Management System</b><br><span class="ims-small">Recipient View &nbsp;|&nbsp; Inward Supplies</span></div>
    <div class="ims-meta"><div><b>Financial Year</b><span>${imsFidelityEscape(ctx.fy)}</span></div><div><b>Return Period</b><span>${imsFidelityEscape(ctx.period)}</span></div><div><b>View</b><span>Recipient — Inward Supplies</span></div><div><b>Last Updated</b><span>${d.updatedAt?new Date(d.updatedAt).toLocaleString('en-IN'):'—'}</span></div></div>
    <div class="ims-tabs">${tabs.map(f=>`<button class="ims-tab ${filter===f?'active':''}" onclick="gstOpenIMSFilter('${f.replace(/'/g,"\\'")}')">${imsFidelityFilterLabel(f)}</button>`).join('')}</div>
    <div class="ims-summary"><div class="box"><div class="n">${c.all}</div><div class="l">All Documents</div></div><div class="box"><div class="n">${c.accept}</div><div class="l">Accepted</div></div><div class="box"><div class="n">${c.reject}</div><div class="l">Rejected</div></div><div class="box"><div class="n">${c.pending}</div><div class="l">Pending</div></div><div class="box"><div class="n">${c.noaction}</div><div class="l">No Action / Deemed Accepted</div></div></div>
    <div class="ims-toolbar"><div class="ims-field" style="min-width:280px"><label>Search</label><input id="imsFSearch" value="${imsFidelityEscape(q)}" placeholder="Supplier GSTIN / invoice no. / supplier name"></div><div class="ims-field"><label>Source</label><select id="imsFSource"><option>All Sources</option><option>GSTR-1</option><option>GSTR-1A</option><option>IFF</option><option>Import of Goods</option></select></div><div class="ims-field"><label>Document Type</label><select id="imsFType"><option>All Types</option><option>B2B Invoice</option><option>Credit Note</option><option>Debit Note</option><option>IMPG</option><option>IMPG Amendments</option><option>IMPGSEZ</option><option>IMPGSEZA Amendments</option></select></div><button class="ims-btn" onclick="imsFidelitySearch()">SEARCH</button><button class="ims-btn alt" onclick="imsFidelityClearSearch()">RESET FILTER</button></div>
    <div class="ims-note"><b>Important:</b> Records saved/filed by suppliers through GSTR-1, GSTR-1A or IFF are presented here for recipient action. <b>No Action</b> is treated as deemed accepted for GSTR-2B generation. Accepted records flow to ITC Available; Rejected records are excluded; Pending records remain in IMS for later action. Actions can be changed until filing of the corresponding GSTR-3B.</div>
    <div class="ims-table-wrap"><table class="ims-table"><thead><tr><th><input type="checkbox" onclick="imsFidelitySelectAll(this)"></th><th>Supplier GSTIN / Name</th><th>Invoice / Date</th><th>Document / Source</th><th>Taxable Value</th><th>Total Tax</th><th>IMS Action</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="ims-pager"><span>Showing ${recs.length?((pg-1)*pageSize+1):0}-${Math.min(pg*pageSize,recs.length)} of ${recs.length}</span>${Array.from({length:totalPages},(_,n)=>`<button class="ims-pagebtn ${pg===n+1?'active':''}" onclick="imsFidelityPage(${n+1},'${filter.replace(/'/g,"\\'")}')">${n+1}</button>`).join('')}</div>
    <div class="ims-bottom"><div class="left"><button class="ims-btn" onclick="imsFidelitySaveSelected()">SAVE SELECTED ACTIONS</button><button class="ims-btn alt" onclick="gstImsDraft2B()">VIEW DRAFT GSTR-2B</button><button class="ims-btn alt" onclick="gstImsAdvisory()">VIEW IMS ADVISORY</button></div><div class="right"><button class="ims-btn alt" onclick="gstImsDownload()">DOWNLOAD</button><button class="ims-btn alt" onclick="gstImsReset()">RESET DEMO DATA</button><button class="ims-btn alt" onclick="openReturnsDashboard()">BACK</button></div></div>
    <div class="ims-note ims-warning"><b>Training simulator:</b> This screen reproduces the GST workflow and terminology locally. It does not connect to GSTN or use live taxpayer data.</div>
  </div>`;
}
function imsFidelityRender(filter='All',page=1){if(!gstRequireLogin('IMS'))return;const d=gstImsSyncSupplierRecords();feature('Invoice Management System (IMS)','Services > Returns > Invoice Management System',imsFidelityBuildBody(d,filter,page))}
function imsFidelitySearch(){const f=document.querySelector('.ims-tab.active')?.textContent?.trim()||'All';imsFidelityRender(f==='All Documents'?'All':f,1)}
function imsFidelityClearSearch(){const el=document.getElementById('imsFSearch');if(el)el.value='';imsFidelityRender('All',1)}
function imsFidelityPage(p,f){imsFidelityRender(f,p)}
function imsFidelitySelectAll(cb){document.querySelectorAll('.ims-row-check').forEach(x=>x.checked=cb.checked)}
function imsFidelityActionChanged(id){const a=document.getElementById('imsAct_'+id)?.value,wrap=document.getElementById('imsReduceWrap_'+id);if(wrap)wrap.style.display=a==='Accept'?'block':'none'}
function imsFidelityReductionChoice(id){const c=document.getElementById('imsReduceChoice_'+id)?.value,r=document.getElementById('imsRed_'+id);if(c==='NO'&&r)r.value='0'}
function imsFidelityReadForm(id){const d=gstImsData(),x=d.records.find(r=>r.id===id);if(!x)return null;return {d,x,action:document.getElementById('imsAct_'+id)?.value||'No Action',remark:document.getElementById('imsRemark_'+id)?.value.trim()||'',red:+document.getElementById('imsRed_'+id)?.value||0}}
function imsFidelitySaveOne(id){const z=imsFidelityReadForm(id);if(!z)return;const {d,x,action,remark,red}=z;if(!imsFidelityActionAllowed(x,action)){notify('This action is not permitted for this document.');return}if((action==='Reject'||action==='Pending')&&!remark){notify('Remark is required for Reject/Pending action.');return}const tax=Math.abs((+x.igst||0)+(+x.cgst||0)+(+x.sgst||0));if(red>tax){notify('ITC reduction cannot exceed the tax amount.');return}if(action!=='Accept')x.itcReduction=0;else x.itcReduction=red;x.action=action;x.remark=remark;x.updatedAt=new Date().toISOString();gstSaveIms(d);notify('Action saved successfully.');imsFidelityRender('All',1)}
function imsFidelitySaveSelected(){const d=gstImsData(),checks=[...document.querySelectorAll('.ims-row-check:checked')];if(!checks.length){notify('Select at least one document.');return}for(const cb of checks){const x=d.records.find(r=>r.id===cb.dataset.id);if(!x)continue;const action=document.getElementById('imsAct_'+x.id)?.value||x.action||'No Action',remark=document.getElementById('imsRemark_'+x.id)?.value.trim()||'',red=+document.getElementById('imsRed_'+x.id)?.value||0;if(!imsFidelityActionAllowed(x,action)){notify('Invalid action for '+x.invoiceNo);return}if((action==='Reject'||action==='Pending')&&!remark){notify('Remark required for '+x.invoiceNo);return}const tax=Math.abs((+x.igst||0)+(+x.cgst||0)+(+x.sgst||0));if(red>tax){notify('ITC reduction exceeds tax for '+x.invoiceNo);return}x.action=action;x.remark=remark;x.itcReduction=action==='Accept'?red:0;x.updatedAt=new Date().toISOString()}gstSaveIms(d);notify('Selected IMS actions saved successfully.');imsFidelityRender('All',1)}
/* Replace the previous IMS renderer with the fidelity renderer. */
gstOpenIMS=imsFidelityRender;
gstOpenIMSFilter=function(filter){imsFidelityRender(filter,1)};


/* ===== Extracted script block ===== */


/* ===== GSTR-3B 95% FIDELITY UI PASS ===== */
(function(){
  const _open = window.gst3bOpen;
  const _saveSection = window.gst3bSaveSection;
  const _save32 = window.gst3bSave32;
  const _saveITC = window.gst3bSaveITC;
  const _save5 = window.gst3bSave5;

  function r3bHead(title, crumb, d){
    const c=gstReturnContext(), t=gstRead('gstTaxpayer',GST_DEMO)||GST_DEMO;
    return `<div class="gst-dash-head"><h2>${esc(title)}</h2><div class="gst-dash-meta"><span>Financial Year: <b>${esc(c.fy)}</b></span><span>Return Period: <b>${esc(c.period)}</b></span><span>GSTIN: <b>${esc(t.gstin)}</b></span><span>Status: <b>${esc(d.status)}</b></span></div></div><div class="gst-breadcrumb">Dashboard &nbsp;›&nbsp; Services &nbsp;›&nbsp; Returns &nbsp;›&nbsp; GSTR-3B &nbsp;›&nbsp; ${esc(crumb)}</div>`;
  }
  function r3bNav(){return `<div class="gst-tabs" style="margin:0 0 14px"><button class="gst-tab active" onclick="gst3bOpen()">GSTR-3B</button><button class="gst-tab" onclick="gst3bSystemSummary()">SYSTEM GENERATED 3B</button><button class="gst-tab" onclick="gst3bPreview()">PREVIEW</button><button class="gst-tab" onclick="gst3bPayment()">PAYMENT / OFFSET</button></div>`}
  function r3bStatus(d){return `<div class="gst-alert info"><b>Training simulator:</b> Values may be assisted from GSTR-1 and GSTR-2B. Review all system-generated values before proceeding. This offline simulator is not connected to GSTN.</div><div class="gst-form-grid" style="grid-template-columns:repeat(4,minmax(0,1fr))"><div><label>GSTR-1</label><div class="gst-readonly">${esc(gst3bGstr1Source()?.status||'Not Furnished')}</div></div><div><label>GSTR-2B</label><div class="gst-readonly">${esc(gst2BData().status||'Not Generated')}</div></div><div><label>Return Status</label><div class="gst-readonly">${esc(d.status)}</div></div><div><label>Filing Frequency</label><div class="gst-readonly">Monthly / QRMP as applicable</div></div></div>`}
  function tile(title,sub,fn,status){return `<div class="gst-return-tile"><div class="rt-head">${title}</div><div class="rt-body"><div class="rt-row"><span>${sub}</span><b>${status||'Review / Edit'}</b></div><div class="rt-actions"><button class="gst-action" onclick="${fn}()">OPEN</button></div></div></div>`}
  function tableRow(label,obj){obj=obj||{};return `<tr><th>${label}</th><td>${gstMoney(obj.taxable)}</td><td>${gstMoney(obj.igst)}</td><td>${gstMoney(obj.cgst)}</td><td>${gstMoney(obj.sgst)}</td><td>${gstMoney(obj.cess)}</td></tr>`}

  window.gst3bBody=function(d){
    const g=gst3bGstr1Source(), b=gst2BData(), l=gst3bLiability(d);
    return r3bHead('Form GSTR-3B — Summary Return','Return Preparation',d)+r3bNav()+r3bStatus(d)+
      `<div class="gst-section-title">3.1 Details of outward supplies and inward supplies liable to reverse charge</div>`+
      `<div class="gst-tile-grid">${tile('3.1 — Outward / RCM','Table 3.1(a) to 3.1(e)','gst3bOpenOutward','')}</div>`+
      `<div class="gst-section-title">3.2 Of the supplies shown in 3.1(a), details of inter-State supplies</div>`+
      `<div class="gst-tile-grid">${tile('3.2 — Inter-State Supplies','Unregistered persons / composition taxpayers / UIN holders','gst3bOpen32','')}</div>`+
      `<div class="gst-section-title">4. Eligible ITC</div>`+
      `<div class="gst-tile-grid">${tile('4 — Eligible ITC','4A ITC available · 4B ITC reversed · 4C net ITC · 4D other','gst3bOpenITC','')}</div>`+
      `<div class="gst-section-title">5. Values of exempt, nil-rated and non-GST inward supplies</div>`+
      `<div class="gst-tile-grid">${tile('5 — Exempt / Nil / Non-GST','Inter-State and Intra-State inward supplies','gst3bOpen5','')}</div>`+
      `<div class="gst-section-title">5.1 Interest and late fee</div><table class="gst-table"><thead><tr><th>Particular</th><th>IGST</th><th>CGST</th><th>SGST/UTGST</th><th>Cess</th><th>Total</th></tr></thead><tbody>`+
      tableRow('Interest',d.input.interest)+tableRow('Late Fee',d.input.lateFee)+tableRow('Penalty',d.input.penalty)+`</tbody></table>`+
      `<div class="gst-section-title">Tax Liability / ITC Summary</div><table class="gst-table"><thead><tr><th>Particular</th><th>IGST</th><th>CGST</th><th>SGST/UTGST</th><th>Cess</th><th>Total</th></tr></thead><tbody>`+
      tableRow('Output tax + RCM + other liability',l.out)+tableRow('Eligible ITC after reversals',l.itc)+tableRow('Net tax liability',l.net)+tableRow('Interest / late fee / penalty',l.charges)+`</tbody></table>`+
      `<div class="gst-alert ${g&&['Submitted','Filed'].includes(g.status)?'success':'warning'}"><b>GSTR-1:</b> ${esc(g?.status||'Not Furnished')}</div>`+
      `<div class="gst-alert ${b.status==='Generated'?'success':'warning'}"><b>GSTR-2B:</b> ${esc(b.status||'Not Generated')}</div>`+
      `<div class="gst-action-row" style="flex-wrap:wrap"><button class="gst-action" onclick="gst3bAutoSave()">SAVE GSTR-3B</button><button class="gst-action secondary" onclick="gst3bSystemSummary()">SYSTEM GENERATED 3B</button><button class="gst-action secondary" onclick="gst3bPreview()">PREVIEW</button><button class="gst-action" onclick="gst3bValidate()">VALIDATE</button><button class="gst-action" onclick="gst3bPayment()">PROCEED TO PAYMENT</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK</button></div>`;
  };

  window.gst3bOpen=function(){if(!gstRequireLogin('GSTR-3B'))return;const d=gst3bAutoPopulate(gst3bData());gst3bSave(d);feature('GSTR-3B — Summary Return','Services > Returns > Returns Dashboard > GSTR-3B',gst3bBody(d))};

  window.gst3bOpenOutward=function(){
    const d=gst3bAutoPopulate(gst3bData());gst3bSave(d);
    feature('GSTR-3B — Table 3.1','GSTR-3B > 3.1',r3bHead('3.1 Details of outward supplies and inward supplies liable to reverse charge','3.1',d)+r3bNav()+
      `<div class="gst-alert info"><b>System assistance:</b> Table 3.1(a), 3.1(b) and relevant liability values may be assisted from the corresponding return data. Review and edit where applicable.</div>`+
      `<div class="gst-table-wrap"><table class="gst-table"><thead><tr><th>Description</th><th>Taxable Value</th><th>Integrated Tax</th><th>Central Tax</th><th>State/UT Tax</th><th>Cess</th></tr></thead><tbody>`+
      gst3bSectionRow('3.1(a) Outward taxable supplies (other than zero rated, nil/exempt and non-GST supplies)','a',d)+
      gst3bSectionRow('3.1(b) Outward taxable supplies — zero rated','b',d)+
      gst3bSectionRow('3.1(c) Other outward supplies — nil rated, exempt','c',d)+
      gst3bSectionRow('3.1(d) Inward supplies liable to reverse charge','d',d)+
      gst3bSectionRow('3.1(e) Non-GST outward supplies','e',d)+`</tbody></table></div>`+
      `<div class="gst-action-row"><button class="gst-action" onclick="gst3bSaveSection('outward')">SAVE</button><button class="gst-action secondary" onclick="gst3bOpen()">BACK</button></div>`);
  };

  window.gst3bOpen32=function(){const d=gst3bData();feature('GSTR-3B — Table 3.2','GSTR-3B > 3.2',r3bHead('3.2 Inter-State supplies made to unregistered persons, composition taxable persons and UIN holders','3.2',d)+r3bNav()+`<div class="gst-alert info">Enter the inter-State supplies included in Table 3.1(a), where applicable. The values entered here should not exceed the corresponding supplies in Table 3.1(a).</div><div class="gst-table-wrap"><table class="gst-table"><thead><tr><th>Place of Supply</th><th>Unregistered Persons</th><th>Composition Taxable Persons</th><th>UIN Holders</th></tr></thead><tbody><tr><td>State / UT wise</td><td><input id="g3b32unreg" class="f-input" type="number" min="0" value="${gst3bNum(d.input.t32unreg)}"></td><td><input id="g3b32comp" class="f-input" type="number" min="0" value="${gst3bNum(d.input.t32comp)}"></td><td><input id="g3b32uin" class="f-input" type="number" min="0" value="${gst3bNum(d.input.t32uin)}"></td></tr></tbody></table></div><div class="gst-action-row"><button class="gst-action" onclick="gst3bSave32()">SAVE</button><button class="gst-action secondary" onclick="gst3bOpen()">BACK</button></div>`) };

  window.gst3bOpenITC=function(){const d=gst3bAutoPopulate(gst3bData());gst3bSave(d);feature('GSTR-3B — Table 4','GSTR-3B > 4',r3bHead('4. Eligible ITC','4',d)+r3bNav()+`<div class="gst-alert info"><b>System-generated assistance:</b> ITC values are assisted from GSTR-2B in this training simulator. Review the source statement and enter applicable reversals.</div><div class="gst-table-wrap"><table class="gst-table"><thead><tr><th>Details</th><th>Integrated Tax</th><th>Central Tax</th><th>State/UT Tax</th><th>Cess</th></tr></thead><tbody><tr><th>4A(1) Import of goods</th>${gst3bInputCells('impGoods',d.input.impGoods||{})}</tr><tr><th>4A(2) Import of services</th>${gst3bInputCells('impServices',d.input.impServices||{})}</tr><tr><th>4A(3) Inward supplies liable to reverse charge</th>${gst3bInputCells('rcm',d.input.rcm||{})}</tr><tr><th>4A(4) Inward supplies from ISD</th>${gst3bInputCells('isd',d.input.isd||{})}</tr><tr><th>4A(5) All other ITC</th>${gst3bInputCells('itcA',d.input.itcA||{})}</tr><tr><th>4B(1) As per rules 38, 42 & 43 and sub-rule (5) of rule 43</th>${gst3bInputCells('itcB',d.input.itcB||{})}</tr><tr><th>4B(2) Others</th>${gst3bInputCells('other',d.input.other||{})}</tr></tbody></table></div><div class="gst-action-row"><button class="gst-action" onclick="gst3bSaveITC()">SAVE</button><button class="gst-action secondary" onclick="gstOpenGstr2B()">VIEW GSTR-2B</button><button class="gst-action secondary" onclick="gst3bOpen()">BACK</button></div>`) };

  window.gst3bOpen5=function(){const d=gst3bData();feature('GSTR-3B — Table 5','GSTR-3B > 5',r3bHead('5. Values of exempt, nil-rated and non-GST inward supplies','5',d)+r3bNav()+`<div class="gst-alert info">Enter inward supplies, excluding supplies covered under reverse charge where applicable.</div><div class="gst-table-wrap"><table class="gst-table"><thead><tr><th>Nature of Supplies</th><th>Inter-State Supplies</th><th>Intra-State Supplies</th></tr></thead><tbody><tr><th>From a composition taxable person</th><td><input class="f-input" id="g3b5is" type="number" min="0" value="${gst3bNum(d.input.t5is)}"></td><td><input class="f-input" id="g3b5intra" type="number" min="0" value="${gst3bNum(d.input.t5intra)}"></td></tr><tr><th>Exempt / nil rated / non-GST inward supplies</th><td><input class="f-input" id="g3b5is2" type="number" min="0" value="${gst3bNum(d.input.t5is2)}"></td><td><input class="f-input" id="g3b5intra2" type="number" min="0" value="${gst3bNum(d.input.t5intra2)}"></td></tr></tbody></table></div><div class="gst-action-row"><button class="gst-action" onclick="gst3bSave5()">SAVE</button><button class="gst-action secondary" onclick="gst3bOpen()">BACK</button></div>`) };

  const oldSave5=window.gst3bSave5; window.gst3bSave5=function(){const d=gst3bData();d.input.t5is=gst3bNum(document.getElementById('g3b5is')?.value);d.input.t5intra=gst3bNum(document.getElementById('g3b5intra')?.value);d.input.t5is2=gst3bNum(document.getElementById('g3b5is2')?.value);d.input.t5intra2=gst3bNum(document.getElementById('g3b5intra2')?.value);d.status='Saved';d.savedAt=new Date().toISOString();gst3bSave(d);gst3bOpen()};

  /* Extend the state model with current Table 4 categories without breaking older saved records. */
  const oldData=window.gst3bData;
  window.gst3bData=function(){const d=oldData();d.input=d.input||{};for(const k of ['impGoods','impServices','isd'])d.input[k]=d.input[k]||{igst:0,cgst:0,sgst:0,cess:0};return d};
})();


/* ===== Extracted script block ===== */


/* ===== GSTR-1 EXACT-STYLE DASHBOARD OVERRIDE =====
   Based on current GSTN GSTR-1/IFF dashboard organization:
   ADD RECORD DETAILS expanded by default; AMEND RECORD DETAILS collapsed.
*/
(function(){
  function g1Tile(title, subtitle, action, d, key){
    const count = key==='b2b'?(d.invoices||[]).length:key==='b2c'?(d.b2c||[]).length:key==='exp'?(d.exports||[]).length:key==='hsn'?(d.hsn||[]).length:key==='doc'?(d.documents||[]).length:key==='notes'?(d.notes||[]).length:0;
    const saved=count;
    const pending=0,error=0;
    return `<div class="g1p-tile"><div class="g1p-tile-head">${title}</div><div class="g1p-tile-body"><div>${subtitle}</div><div class="g1p-counts"><span class="g1p-count saved">Saved: ${saved}</span><span class="g1p-count pending">Pending: ${pending}</span><span class="g1p-count error">Errored: ${error}</span></div><div class="g1p-actions"><button class="g1p-open" onclick="${action}">ADD RECORD</button></div></div></div>`;
  }
  function g1AmendTile(title, subtitle, action){
    return `<div class="g1p-tile"><div class="g1p-tile-head">${title}</div><div class="g1p-tile-body"><div>${subtitle}</div><div class="g1p-counts"><span class="g1p-count saved">Saved: 0</span><span class="g1p-count pending">Pending: 0</span><span class="g1p-count error">Errored: 0</span></div><div class="g1p-actions"><button class="g1p-open" onclick="${action}">AMEND RECORD</button></div></div></div>`;
  }
  function g1Body(){
    const c=gstReturnContext(),d=gstGstr1Data(),s=gstGstr1Summary(d);
    const submitted=d.status==='Submitted'||d.status==='Filed';
    const add=[
      g1Tile('4A, 4B, 4C, 6B, 6C — B2B INVOICES','B2B / SEZ / Deemed Export invoices','gstGstr1B2B()',d,'b2b'),
      g1Tile('5A, 5B — B2C (LARGE) INVOICES','B2C Large outward supplies','gstGstr1B2C()',d,'b2c'),
      g1Tile('6A — EXPORTS INVOICES','Export invoices','gstGstr1Exports()',d,'exp'),
      g1Tile('7 — B2C (OTHERS)','Other B2C outward supplies','gstGstr1B2C()',d,'b2c'),
      g1Tile('8A, 8B, 8C, 8D — NIL / EXEMPT / NON-GST','Nil-rated, exempt and non-GST supplies','gstGstr1B2C()',d,'b2c'),
      g1Tile('9B — CREDIT / DEBIT NOTES (REGISTERED)','Credit/debit notes issued to registered persons','gstGstr1B2B()',d,'notes'),
      g1Tile('9B — CREDIT / DEBIT NOTES (UNREGISTERED)','Credit/debit notes issued to unregistered persons','gstGstr1B2C()',d,'notes'),
      g1Tile('11A(1), 11A(2) — TAX LIABILITY (ADVANCES RECEIVED)','Advances received','gstGstr1B2C()',d,'b2c'),
      g1Tile('11B(1), 11B(2) — ADJUSTMENT OF ADVANCES','Adjustment of advances','gstGstr1B2C()',d,'b2c'),
      g1Tile('12 — HSN-WISE SUMMARY OF OUTWARD SUPPLIES','HSN/SAC summary','gstGstr1Hsn()',d,'hsn'),
      g1Tile('13 — DOCUMENTS ISSUED','Document series / issued documents','gstGstr1Documents()',d,'doc'),
      g1Tile('14 — SUPPLIES THROUGH E-COMMERCE OPERATOR','Supplies reported through ECO','gstGstr1B2C()',d,'b2c'),
      g1Tile('15 — SUPPLIES U/S 9(5)','Supplies covered under section 9(5)','gstGstr1B2C()',d,'b2c')
    ].join('');
    const amend=[
      g1AmendTile('9A — AMENDED B2B INVOICES','Amend previously furnished B2B invoices','gstGstr1B2B()'),
      g1AmendTile('9A — AMENDED B2C (LARGE) INVOICES','Amend previously furnished B2C Large invoices','gstGstr1B2C()'),
      g1AmendTile('9A — AMENDED EXPORTS INVOICES','Amend previously furnished export invoices','gstGstr1Exports()'),
      g1AmendTile('9C — AMENDED CREDIT / DEBIT NOTES (REGISTERED)','Amend registered-party notes','gstGstr1B2B()'),
      g1AmendTile('9C — AMENDED CREDIT / DEBIT NOTES (UNREGISTERED)','Amend unregistered-party notes','gstGstr1B2C()'),
      g1AmendTile('10 — AMENDED B2C (OTHERS)','Amend B2C Others','gstGstr1B2C()'),
      g1AmendTile('11A — AMENDED TAX LIABILITY (ADVANCES)','Amend advance liability','gstGstr1B2C()'),
      g1AmendTile('11B — AMENDED ADJUSTMENT OF ADVANCES','Amend advance adjustments','gstGstr1B2C()'),
      g1AmendTile('14A — AMENDED SUPPLIES THROUGH ECO','Amend ECO supplies','gstGstr1B2C()'),
      g1AmendTile('15A — AMENDED SUPPLIES U/S 9(5)','Amend section 9(5) supplies','gstGstr1B2C()')
    ].join('');
    return `<div class="g1p-shell">
      <div class="g1p-topnote"><b>GSTR-1</b> &nbsp; Details of outward supplies of goods or services &nbsp; | &nbsp; <b>*</b> Indicates mandatory fields</div>
      <div class="g1p-tools"><button class="g1p-tool" onclick="notify('e-Invoice advisory opened in training simulator')">e-Invoice Advisory</button><button class="g1p-tool" onclick="notify('e-Invoice help opened in training simulator')">e-Invoice Help</button><button class="g1p-tool" onclick="gstGstr1Preview()">View / Preview</button></div>
      <div class="g1p-section" id="g1AddSection"><div class="g1p-section-head" onclick="g1ToggleSection('g1AddSection')"><span>ADD RECORD DETAILS</span><span class="chev">⌃</span></div><div class="g1p-section-body"><div class="g1p-grid">${add}</div></div></div>
      <div class="g1p-section collapsed" id="g1AmendSection"><div class="g1p-section-head" onclick="g1ToggleSection('g1AmendSection')"><span>AMEND RECORD DETAILS</span><span class="chev">⌄</span></div><div class="g1p-section-body"><div class="g1p-grid">${amend}</div></div></div>
      <div class="g1p-summary"><div class="g1p-summary-head">Summary of GSTR-1 Details</div><table><thead><tr><th>Particulars</th><th>Count / Value</th><th>Particulars</th><th>Count / Value</th></tr></thead><tbody><tr><td>Documents</td><td>${s.count}</td><td>Taxable Value</td><td>${gstMoney(s.taxable)}</td></tr><tr><td>IGST</td><td>${gstMoney(s.igst)}</td><td>CGST + SGST/UTGST</td><td>${gstMoney(s.cgst+s.sgst)}</td></tr><tr><td>Return Status</td><td><b>${esc(d.status)}</b></td><td>Return Period</td><td>${esc(c.period)}</td></tr></tbody></table></div>
      <div class="g1p-bottom"><div><button class="g1p-secondary" onclick="openReturnsDashboard()">BACK</button></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="g1p-secondary" onclick="gstGstr1GenerateSummary()">GENERATE GSTR-1 SUMMARY</button><button class="g1p-secondary" onclick="gstGstr1Preview()">PREVIEW GSTR-1</button><button class="g1p-primary ${submitted?'g1p-disabled':''}" ${submitted?'disabled':''} onclick="gstGstr1Validate()">VALIDATE</button><button class="g1p-primary ${submitted?'g1p-disabled':''}" ${submitted?'disabled':''} onclick="gstGstr1Submit()">SUBMIT</button></div></div>
      <div id="gstGstr1Msg" class="demo-note"></div>
    </div>`;
  }
  window.g1ToggleSection=function(id){const el=document.getElementById(id);if(!el)return;el.classList.toggle('collapsed');const chev=el.querySelector('.chev');if(chev)chev.textContent=el.classList.contains('collapsed')?'⌄':'⌃'};
  window.gstOpenGstr1=function(){if(!gstRequireLogin('GSTR-1'))return;const c=gstReturnContext();localStorage.setItem('gstReturnFY',c.fy);localStorage.setItem('gstReturnPeriod',c.period);feature('GSTR-1 — Details of outward supplies of goods or services','Returns > Returns Dashboard > GSTR-1 > Prepare Online',g1Body())};
  window.gstGstr1Body=g1Body;
})();


/* ===== Extracted script block ===== */


(function(){
  /* Final fidelity layer: payment/offset + ledger screens.  Training-only, no GSTN connection. */
  const money2 = window.money || window.gstMoney || (n=> '₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}));
  const esc2 = window.esc || (s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])));
  const now2=()=>new Date().toISOString();
  function state(){try{return JSON.parse(localStorage.getItem('gstLedgerEngineV2')||'null')||window.gstLedgerEngine()}catch(e){return window.gstLedgerEngine()}}
  function saveState(x){localStorage.setItem('gstLedgerEngineV2',JSON.stringify(x))}
  const HEAD=['igst','cgst','sgst','cess'], MIN=['tax','interest','penalty','fee','others'];
  function minorTotal(h){return MIN.reduce((a,m)=>a+Number(h?.[m]||0),0)}
  function cash(x,h,m){return Number(x.cash?.[h]?.[m]||0)}
  function liability(x,h,m){return Number(x.liability?.[h]?.[m]||0)}
  function credit(x,h){return Number(x.credit?.[h]||0)}
  function totalLiab(x){return HEAD.reduce((a,h)=>a+minorTotal(x.liability?.[h]),0)}
  function totalCash(x){return HEAD.reduce((a,h)=>a+MIN.reduce((b,m)=>b+cash(x,h,m),0),0)}
  function totalCredit(x){return HEAD.reduce((a,h)=>a+credit(x,h),0)}
  function log(x,type,ref,detail,amounts){x.transactions=x.transactions||[];x.transactions.push({at:now2(),type,reference:ref||'',detail:detail||'',amounts:amounts||{}});x.audit=x.audit||[];x.audit.push({at:now2(),user:'Demo Taxpayer',module:'Payment / Ledgers',action:type,reference:ref||'',detail:detail||''})}
  function headRows(x, obj, isCredit){return HEAD.map(h=>`<tr><td>${h.toUpperCase()}</td>${isCredit?`<td>${money2(credit(x,h))}</td>`:MIN.map(m=>`<td>${money2(obj[h]?.[m]||0)}</td>`).join('')+`<td><b>${money2(minorTotal(obj[h]))}</b></td>`}</tr>`).join('')}

  window.gst3bPayment=function(){
    const d=window.gst3bData?window.gst3bData():null;
    if(!d || d.status!=='Validated'){feature('GSTR-3B — Payment / Offset','GSTR-3B > Payment / Offset','<div class="gst-alert warning"><b>Validation is required before payment.</b> Validate the saved GSTR-3B first.</div><button class="gst-action" onclick="gst3bValidate()">VALIDATE</button> <button class="gst-action secondary" onclick="gst3bOpen()">BACK</button>');return;}
    const x=state(), l=window.gst3bLiability?window.gst3bLiability(d):{total:0,itc:{}};
    const availCredit=totalCredit(x), availCash=totalCash(x), payable=Math.max(0,Number(l.total||0));
    feature('GSTR-3B — Payment of Tax','Returns > GSTR-3B > Payment of Tax',`
      <div class="gst-portal-band"><b>Payment of Tax</b><span>GSTR-3B</span></div>
      <div class="gst-alert info">Review the liability, available Electronic Credit Ledger and Electronic Cash Ledger before offsetting. In this training simulator, the actual statutory utilization algorithm is represented head-wise for training and no real payment is made.</div>
      <div class="gst-summary-grid">
        <div class="gst-summary"><div class="label">Total Liability</div><div class="value">${money2(payable)}</div><div class="sub">Calculated from GSTR-3B</div></div>
        <div class="gst-summary"><div class="label">Electronic Credit Ledger</div><div class="value">${money2(availCredit)}</div><div class="sub">Available ITC</div></div>
        <div class="gst-summary"><div class="label">Electronic Cash Ledger</div><div class="value">${money2(availCash)}</div><div class="sub">Available cash</div></div>
        <div class="gst-summary"><div class="label">Additional Cash Required</div><div class="value">${money2(Math.max(0,payable-Math.min(payable,availCredit)-availCash))}</div><div class="sub">Create PMT-06 if required</div></div>
      </div>
      <div class="gst-section-title">Liability / Available Balance</div>
      <div class="gst-table-wrap"><table class="gst-table"><thead><tr><th>Head</th><th>Liability</th><th>Credit Available</th><th>Cash Available</th><th>To Be Paid</th></tr></thead><tbody>
      ${HEAD.map(h=>{const li=minorTotal(x.liability[h]);const cr=credit(x,h);const ca=MIN.reduce((a,m)=>a+cash(x,h,m),0);return `<tr><td>${h.toUpperCase()}</td><td>${money2(li)}</td><td>${money2(cr)}</td><td>${money2(ca)}</td><td>${money2(Math.max(0,li-Math.min(li,cr)-Math.min(Math.max(0,li-Math.min(li,cr)),ca)))}</td></tr>`}).join('')}
      </tbody></table></div>
      <div class="gst-section-title">Offset / Payment</div>
      <div class="gst-form-grid">
        <div><label>Credit Ledger Amount to Utilise</label><input id="g3bCreditUse2" class="f-input" type="number" min="0" step="0.01" value="${Math.min(payable,availCredit).toFixed(2)}"></div>
        <div><label>Cash Ledger Amount to Utilise</label><input id="g3bCashUse2" class="f-input" type="number" min="0" step="0.01" value="${Math.max(0,payable-Math.min(payable,availCredit)).toFixed(2)}"></div>
      </div>
      <div class="gst-action-row"><button class="gst-action" onclick="gst3bOffset()">UTILIZE ITC / CASH</button><button class="gst-action secondary" onclick="challan()">CREATE CHALLAN (PMT-06)</button><button class="gst-action secondary" onclick="cashLedger()">VIEW CASH LEDGER</button><button class="gst-action secondary" onclick="creditLedger()">VIEW CREDIT LEDGER</button></div>
      <div class="gst-note">If the cash ledger is insufficient, create a challan, complete the simulated bank payment and return here. A challan by itself does not credit the Cash Ledger; the simulated CIN confirmation does.</div>`);
  };

  window.gst3bOffset=function(){
    const d=window.gst3bData?window.gst3bData():null; if(!d)return;
    const x=state(); const l=window.gst3bLiability?window.gst3bLiability(d):{total:0};
    const cu=Math.max(0,Number(document.getElementById('g3bCreditUse2')?.value||0));
    const ca=Math.max(0,Number(document.getElementById('g3bCashUse2')?.value||0));
    const total=Number(l.total||0); const availCr=totalCredit(x), availCa=totalCash(x);
    const msg=(html)=>feature('GSTR-3B — Payment / Offset','Returns > GSTR-3B > Payment / Offset',html+'<div class="gst-action-row"><button class="gst-action" onclick="gst3bPayment()">BACK TO PAYMENT</button></div>');
    if(cu>availCr+0.005){msg('<div class="gst-alert error"><b>Offset failed.</b> Credit utilisation exceeds the available Electronic Credit Ledger balance.</div>');return;}
    if(ca>availCa+0.005){msg('<div class="gst-alert error"><b>Offset failed.</b> Cash utilisation exceeds the available Electronic Cash Ledger balance.</div><div class="gst-note">Create and pay a PMT-06 challan if additional cash is required.</div>');return;}
    if(cu+ca+0.005<total){msg('<div class="gst-alert error"><b>Offset failed.</b> Credit plus cash does not fully cover the liability.</div>');return;}
    // Training allocation: consume credit by major head, then cash by matching major/minor heads.
    let remCr=cu, remCash=ca, applied={credit:{},cash:{}};
    for(const h of HEAD){const take=Math.min(remCr,credit(x,h)); if(take>0){x.credit[h]-=take;applied.credit[h]=take;remCr-=take;}}
    for(const h of HEAD){for(const m of MIN){if(remCash<=0)break;const take=Math.min(remCash,cash(x,h,m),minorTotal(x.liability[h]));if(take>0){x.cash[h][m]-=take;applied.cash[`${h}_${m}`]=take;remCash-=take;}}}
    // Reduce liability in head order, tax first then other minor heads.
    let rem=total;
    for(const h of HEAD){for(const m of MIN){if(rem<=0)break;const before=liability(x,h,m);const take=Math.min(rem,before);if(take>0){x.liability[h][m]-=take;rem-=take;}}}
    const ref='OFF-SIM-'+Date.now().toString().slice(-12);
    d.payment={creditUsed:cu,cashUsed:ca,reference:ref,at:now2(),allocation:applied}; d.status='Payment Completed'; d.audit=d.audit||[];d.audit.push({at:now2(),action:'UTILIZE ITC / CASH',reference:ref});
    log(x,'LIABILITY OFFSET',ref,'GSTR-3B liability offset completed',{credit:cu,cash:ca,total}); saveState(x); if(window.gst3bSave)window.gst3bSave(d);
    msg(`<div class="gst-alert success"><b>Payment / offset completed successfully.</b></div><div class="gst-table-wrap"><table class="gst-table"><tr><th>Total Liability</th><td>${money2(total)}</td><th>ITC Utilised</th><td>${money2(cu)}</td></tr><tr><th>Cash Utilised</th><td>${money2(ca)}</td><th>Remaining Liability</th><td>${money2(rem)}</td></tr><tr><th>Simulated Offset Reference</th><td colspan="3"><b>${ref}</b></td></tr></table></div><div class="gst-note">Training transaction only — no government payment or GSTN transaction was performed.</div><div class="gst-action-row"><button class="gst-action" onclick="gst3bFilePage()">PROCEED TO FILE</button><button class="gst-action secondary" onclick="cashLedger()">VIEW CASH LEDGER</button><button class="gst-action secondary" onclick="creditLedger()">VIEW CREDIT LEDGER</button><button class="gst-action secondary" onclick="liabilityRegister()">VIEW LIABILITY REGISTER</button></div>`);
  };

  window.cashLedger=function(){const x=state();feature('Electronic Cash Ledger','Services > Ledgers > Electronic Cash Ledger',`
    <div class="gst-portal-band"><b>Electronic Cash Ledger</b><span>Services &gt; Ledgers</span></div>
    <div class="gst-alert info">Cash deposits are shown major-head and minor-head wise. The balance is updated only after simulated payment confirmation/CIN. Real GST Portal cash-ledger viewing supports a date-range transaction report.</div>
    <div class="gst-form-grid"><div><label>From Date</label><input class="f-input" type="date" value="2026-07-01"></div><div><label>To Date</label><input class="f-input" type="date" value="2026-08-10"></div><div><label>Major Head</label><select class="f-select"><option>All</option>${HEAD.map(h=>`<option>${h.toUpperCase()}</option>`).join('')}</select></div></div>
    <div class="gst-summary-grid">${HEAD.map(h=>`<div class="gst-summary"><div class="label">${h.toUpperCase()}</div><div class="value">${money2(MIN.reduce((a,m)=>a+cash(x,h,m),0))}</div><div class="sub">Cash balance</div></div>`).join('')}</div>
    <div class="gst-action-row"><button class="gst-action" onclick="challan()">CREATE CHALLAN (PMT-06)</button><button class="gst-action secondary" onclick="gstPmt09()">FILE PMT-09</button><button class="gst-action secondary" onclick="gstLedgerHistory('cash')">GENERATE TRANSACTION REPORT</button><button class="gst-action secondary" onclick="paymentStatus()">TRACK PAYMENT</button></div>
    <div class="gst-table-wrap"><table class="gst-table"><thead><tr><th>Major Head</th>${MIN.map(m=>`<th>${m.toUpperCase()}</th>`).join('')}<th>Total</th></tr></thead><tbody>${headRows(x,x.cash,false)}</tbody></table></div>
    <div class="gst-note">Official GST guidance lists IGST, CGST, SGST/UTGST and CESS major heads with Tax, Interest, Penalty, Fee and Others minor heads. citeturn0search0</div>`)};

  window.creditLedger=function(){const x=state();feature('Electronic Credit Ledger','Services > Ledgers > Electronic Credit Ledger',`
    <div class="gst-portal-band"><b>Electronic Credit Ledger</b><span>Services &gt; Ledgers</span></div>
    <div class="gst-alert info">The Electronic Credit Ledger contains eligible ITC. It is separate from the Electronic Cash Ledger.</div>
    <div class="gst-summary-grid">${HEAD.map(h=>`<div class="gst-summary"><div class="label">${h.toUpperCase()}</div><div class="value">${money2(credit(x,h))}</div><div class="sub">Available ITC</div></div>`).join('')}</div>
    <div class="gst-action-row"><button class="gst-action" onclick="gst3bOpen()">OPEN GSTR-3B</button><button class="gst-action secondary" onclick="gstLedgerHistory('credit')">VIEW TRANSACTIONS</button></div>
    <div class="gst-table-wrap"><table class="gst-table"><thead><tr><th>Major Head</th><th>Opening / Current Balance</th><th>Source</th><th>Status</th></tr></thead><tbody>${HEAD.map(h=>`<tr><td>${h.toUpperCase()}</td><td>${money2(credit(x,h))}</td><td>GSTR-2B / Imports / Eligible ITC</td><td><span class="gst-status green">Available</span></td></tr>`).join('')}</tbody></table></div>`)};

  window.liabilityRegister=function(){const x=state();feature('Electronic Liability Register','Services > Ledgers > Electronic Liability Register',`
    <div class="gst-portal-band"><b>Electronic Liability Register</b><span>Services &gt; Ledgers</span></div>
    <div class="gst-alert info">Liabilities are tracked major-head/minor-head wise. Successful offsets reduce the outstanding balance and create an audit transaction.</div>
    <div class="gst-summary-grid">${HEAD.map(h=>`<div class="gst-summary"><div class="label">${h.toUpperCase()}</div><div class="value">${money2(minorTotal(x.liability[h]))}</div><div class="sub">Outstanding</div></div>`).join('')}</div>
    <div class="gst-table-wrap"><table class="gst-table"><thead><tr><th>Major Head</th>${MIN.map(m=>`<th>${m.toUpperCase()}</th>`).join('')}<th>Total</th></tr></thead><tbody>${headRows(x,x.liability,false)}</tbody></table></div>
    <div class="gst-action-row"><button class="gst-action" onclick="gst3bOpen()">OPEN GSTR-3B</button><button class="gst-action secondary" onclick="gstLedgerHistory('liability')">VIEW LIABILITY HISTORY</button></div>`)};

  window.gstLedgerHistory=function(kind){const x=state();const rx=kind==='cash'?/cash|challan|offset|pmt-09|payment/i:kind==='credit'?/credit|itc|offset/i:/liability|offset|demand|return/i;const rows=(x.transactions||[]).filter(t=>rx.test((t.type||'')+' '+(t.detail||''))).slice().reverse();const back=kind==='cash'?'cashLedger':kind==='credit'?'creditLedger':'liabilityRegister';feature((kind==='cash'?'Cash':kind==='credit'?'Credit':'Liability')+' Ledger — Transaction Report','Services > Ledgers > Transaction Report',`<div class="gst-action-row"><button class="gst-action secondary" onclick="${back}()">BACK</button></div><div class="gst-table-wrap"><table class="gst-table"><thead><tr><th>Date/Time</th><th>Type</th><th>Reference</th><th>Detail</th></tr></thead><tbody>${rows.map(t=>`<tr><td>${new Date(t.at).toLocaleString('en-IN')}</td><td>${esc2(t.type)}</td><td>${esc2(t.reference||'-')}</td><td>${esc2(t.detail||'-')}</td></tr>`).join('')||'<tr><td colspan="4">No transactions found.</td></tr>'}</tbody></table></div>`)};

  window.gst3bFilePage=window.gst3bFilePage||function(){};
})();
(function(){
  'use strict';

  // One-time migration: discard legacy demo taxpayer/session state from older simulator builds so the new registration journey starts clean.
  if(localStorage.getItem('gstTrainingSchemaVersion')!=='2'){['gstRegistration','gstApplicationStatus','gstARN','gstLoggedIn','gstLoginTime','gstTaxpayer','gstPartA','gstPartBData','gstTRN','gstTRNGeneratedAt','gstLedgerEngineV2','gstCashLedgerTraining'].forEach(k=>localStorage.removeItem(k));localStorage.setItem('gstTrainingSchemaVersion','2');}

  const _openModal = window.openModal;
  const _gstEnsureSession = window.gstEnsureSession;
  const STATE_CODES={
    'Jammu and Kashmir':'01','Himachal Pradesh':'02','Punjab':'03','Chandigarh':'04','Uttarakhand':'05','Haryana':'06','Delhi':'07','Rajasthan':'08','Uttar Pradesh':'09','Bihar':'10','Sikkim':'11','Arunachal Pradesh':'12','Nagaland':'13','Manipur':'14','Mizoram':'15','Tripura':'16','Meghalaya':'17','Assam':'18','West Bengal':'19','Jharkhand':'20','Odisha':'21','Chhattisgarh':'22','Madhya Pradesh':'23','Gujarat':'24','Dadra and Nagar Haveli and Daman and Diu':'26','Maharashtra':'27','Andhra Pradesh':'37','Karnataka':'29','Goa':'30','Lakshadweep':'31','Kerala':'32','Tamil Nadu':'33','Puducherry':'34','Andaman and Nicobar Islands':'35','Telangana':'36','Ladakh':'38'
  };
  const esc0=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  function read(k,f){try{const v=localStorage.getItem(k);return v===null?f:JSON.parse(v)}catch(e){return f}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function registration(){return read('gstRegistration',{});}
  function appStatus(){return localStorage.getItem('gstApplicationStatus')||'Not Started'}
  function panFromRegistration(){const a=read('gstPartA',{}),p=read('gstPartBData',{});return (a.pan||'').toUpperCase()}
  function stateFromRegistration(){const a=read('gstPartA',{}),p=read('gstPartBData',{});return p.state||a.state||''}
  function checksumGSTIN(prefix){
    const chars='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let factor=2,sum=0;
    for(let i=prefix.length-1;i>=0;i--){let code=chars.indexOf(prefix[i]);let add=factor*code;sum+=Math.floor(add/36)+add%36;factor=factor===2?1:2;}
    const rem=sum%36;return chars[(36-rem)%36];
  }
  function makeSimGSTIN(){
    const pan=panFromRegistration().replace(/[^A-Z0-9]/g,'');
    const state=STATE_CODES[stateFromRegistration()]||'32';
    const core=state+(pan||'ABCDE1234F')+'1Z';
    return core+checksumGSTIN(core);
  }
  function makeUsername(){
    const a=read('gstPartA',{}), pan=panFromRegistration();
    const base=(a.email||'taxpayer').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,14)||'taxpayer';
    return base+'_'+(pan.slice(-4)||'0000');
  }
  function makeTempPassword(){return 'GST@'+Math.random().toString(36).slice(2,7).toUpperCase()+'26';}
  function ensureRegistration(){
    const a=read('gstPartA',{}),p=read('gstPartBData',{});
    const r=registration();
    if(!r.arn && localStorage.getItem('gstARN')) r.arn=localStorage.getItem('gstARN');
    if(!r.status && localStorage.getItem('gstApplicationStatus')) r.status=localStorage.getItem('gstApplicationStatus');
    if(a||p){r.partA=a;r.partB=p;r.pan=panFromRegistration();r.state=stateFromRegistration();r.legalName=a.legalName||p.tradeName||'';r.email=a.email||'';r.mobile=a.mobile||'';}
    if(r.arn) write('gstRegistration',r);
    return r;
  }

  // Registration submission: remain Pending first, then provide a controlled training-only processing step.
  window.submitPartBFinal=function(method){
    if(typeof partBData==='function') partBData();
    if(typeof collectBanks==='function') collectBanks();
    const errs=typeof validatePartB==='function'?validatePartB():[];
    const box=document.getElementById('partBGlobalMessage');
    if(errs.length){if(box){box.className='reg-message error';box.innerHTML='<b>Please complete the following:</b><ul>'+errs.map(e=>`<li>${esc0(e)}</li>`).join('')+'</ul>';box.style.display='block';}return;}
    const arn='AA32'+new Date().getFullYear()+Math.random().toString(36).slice(2,10).toUpperCase();
    const a=read('gstPartA',{}),p=read('gstPartBData',{});
    const r={arn,status:'Pending for Processing',submittedAt:new Date().toISOString(),method,legalName:a.legalName||'',tradeName:p.tradeName||'',pan:a.pan||'',state:p.state||a.state||'',email:a.email||'',mobile:a.mobile||'',trn:localStorage.getItem('gstTRN')||'',aadhaarStatus:p.aadhaarAuth==='Yes'?'Pending Authentication':'Not Opted'};
    write('gstRegistration',r);localStorage.setItem('gstARN',arn);localStorage.setItem('gstApplicationStatus','Pending for Processing');
    if(box){box.className='reg-message';box.innerHTML=`<b>Application submitted successfully in the training simulator.</b><br>Application Reference Number (ARN): <strong>${arn}</strong><br>Submission method: ${esc0(method)}<br>Status: <strong>Pending for Processing</strong><hr><div class="reg-message-note">This is the real post-submission state. GSTN processing is not available offline. Use the training-only control below to simulate the officer/deemed-approval outcome.</div><button class="reg-proceed" type="button" onclick="window.simulateRegistrationApproval()">SIMULATE REGISTRATION PROCESSING / APPROVAL</button><button class="reg-back-btn" type="button" onclick="track('track-registration')">TRACK APPLICATION STATUS</button>`;box.style.display='block';}
  };

  window.simulateRegistrationApproval=function(){
    window.gstShowLoader('Processing application...');
    setTimeout(()=>{
    try {
    const r=ensureRegistration();
    if(!r.arn){notify('Submit the registration application first.');return;}
    r.status='Approved';r.approvedAt=new Date().toISOString();r.gstin=makeSimGSTIN();r.registrationStatus='Active';r.username=r.gstin;r.tempPassword=makeTempPassword();r.firstLogin=true;
    write('gstRegistration',r);localStorage.setItem('gstApplicationStatus','Approved');
    // A newly registered training taxpayer starts with zero shared-ledger balances.
    write('gstLedgerEngineV2',{version:2,cash:{igst:{tax:0,interest:0,penalty:0,fee:0,others:0},cgst:{tax:0,interest:0,penalty:0,fee:0,others:0},sgst:{tax:0,interest:0,penalty:0,fee:0,others:0},cess:{tax:0,interest:0,penalty:0,fee:0,others:0}},credit:{igst:0,cgst:0,sgst:0,cess:0},liability:{igst:{tax:0,interest:0,penalty:0,fee:0,others:0},cgst:{tax:0,interest:0,penalty:0,fee:0,others:0},sgst:{tax:0,interest:0,penalty:0,fee:0,others:0},cess:{tax:0,interest:0,penalty:0,fee:0,others:0}},transactions:[],challans:[],audit:[]});
    const taxpayer={gstin:r.gstin,legalName:r.legalName||'Registered Taxpayer',tradeName:r.tradeName||r.legalName||'Registered Taxpayer',state:r.state||'Kerala',taxpayerType:(read('gstPartBData',{}).taxpayerType||'Regular'),frequency:'Monthly',fy:'2026-27',period:'Jul 2026',registrationStatus:'Active',arn:r.arn};
    write('gstTaxpayer',taxpayer);
    localStorage.removeItem('gstLoggedIn');localStorage.removeItem('gstLoginTime');
    showRegistrationApproved();
    } catch(e) { console.error('Registration approval error:', e); if(typeof notify==='function') notify('Approval could not be completed: '+(e.message||e)); }
    window.gstHideLoader();
    },window.gstRandomDelay());
  };

  function showRegistrationApproved(){
    const r=registration();
    if(typeof feature==='function'){
      feature('Registration Approved','Registration > Application Approved',`
        <div class="gst-dash-head"><h2>Registration Approved</h2><div class="gst-dash-meta"><span>ARN: <b>${esc0(r.arn||'')}</b></span><span>Status: <b>Active</b></span></div></div>
        <div class="gst-alert success"><b>Registration application approved successfully in the training simulator.</b></div>
        <table class="gst-table" style="width:100%">
          <tr><th>Application Form</th><td>FORM GST REG-01</td></tr>
          <tr><th>ARN</th><td><b>${esc0(r.arn||'')}</b></td></tr>
          <tr><th>Legal Name</th><td>${esc0(r.legalName||'')}</td></tr>
          <tr><th>State / UT</th><td>${esc0(r.state||'')}</td></tr>
          <tr><th>Registration Status</th><td><span class="gst-status green">Active</span></td></tr>
          <tr><th>Simulated GSTIN</th><td><b>${esc0(r.gstin||'')}</b></td></tr>
        </table>
        <div class="gst-alert info"><b>Next step: First-time taxpayer login.</b><br>In the real GST process, the GSTIN/temporary credentials are communicated to the primary authorised signatory after registration approval. This simulator reproduces that delivery locally.</div>
        <div class="gst-table-wrap"><table class="gst-table"><tr><th>Temporary Username</th><td><b>${esc0(r.username||r.gstin||'')}</b></td></tr><tr><th>Temporary Password</th><td><b>${esc0(r.tempPassword||'')}</b></td></tr><tr><th>Delivery</th><td>Simulated email / SMS to registered contact</td></tr></table></div>
        <div class="gst-action-row">
          <button class="gst-action" type="button" onclick="window.gstProceedToLogin()">GO TO TAXPAYER LOGIN</button>
          <button class="gst-action secondary" type="button" onclick="track('track-registration')">VIEW APPLICATION STATUS</button>
        </div>
        <div class="demo-note trn-demo-note">Training-only approval and GSTIN. No government processing was performed.</div>
      `);
      return;
    }
    // Fallback only if the feature shell is unavailable.
    const main=document.querySelector('.main');
    if(!main)return;
    main.innerHTML=`<div class="content"><div class="reg-page"><div class="trn-success-box"><h2>Registration Approved</h2><p>ARN: <b>${esc0(r.arn||'')}</b></p><p>Simulated GSTIN: <b>${esc0(r.gstin||'')}</b></p><button class="reg-proceed" type="button" onclick="window.gstProceedToLogin()">GO TO TAXPAYER LOGIN</button></div></div></div>`;
  }

  // Application tracker now reads the actual registration state instead of a hard-coded fake row.
  window.applications=function(){
    if(typeof gstRequireLogin==='function'&&!gstRequireLogin('My Applications'))return;
    const r=registration();
    const rows=r.arn?`<tr><td>Registration</td><td>${esc0(r.arn)}</td><td><span class="gst-status ${r.status==='Approved'?'green':'orange'}">${esc0(r.status)}</span></td><td>${r.submittedAt?new Date(r.submittedAt).toLocaleString('en-IN'):''}</td></tr>`:'<tr><td colspan="4">No registration application has been submitted in this training session.</td></tr>';
    feature('My Applications','Services > User Services > My Applications',`<div class="gst-alert info"><b>Application Status</b> — live simulator state from your current registration journey.</div><table class="gst-table"><thead><tr><th>Application</th><th>ARN</th><th>Status</th><th>Submitted</th></tr></thead><tbody>${rows}</tbody></table>${r.arn&&r.status!=='Approved'?'<div class="gst-action-row"><button class="gst-action" onclick="track(\'track-registration\')">TRACK REGISTRATION</button></div>':''}${r.status==='Approved'?`<div class="gst-action-row"><button class="gst-action" onclick="window.gstProceedToLogin()">LOGIN AS REGISTERED TAXPAYER</button></div>`:''}`);
  };

  // Registration tracking reads the same state and exposes the real sequence of the training simulation.
  const _track=window.track;
  window.track=function(t){
    if(t!=='track-registration')return _track(t);
    const r=registration();
    if(!r.arn){return feature('Track Registration Application','Services > Track Application Status > Registration',`<div class="gst-alert info">No registration application has been submitted yet.</div><button class="gst-action" onclick="openFeature('new-registration')">NEW REGISTRATION</button>`)}
    const stages=[['Application submitted',true],['Validation / processing',r.status==='Pending for Processing'||r.status==='Approved'],['Approval / order',r.status==='Approved'],['GSTIN active',r.status==='Approved']];
    feature('Track Registration Application','Services > Track Application Status > Registration',`<div class="gst-dash-head"><h2>Track Application Status</h2><div class="gst-dash-meta"><span>ARN: <b>${esc0(r.arn)}</b></span><span>Status: <b>${esc0(r.status)}</b></span></div></div><table class="gst-table"><tr><th>Application Type</th><td>New Registration — FORM GST REG-01</td></tr><tr><th>Legal Name</th><td>${esc0(r.legalName||'')}</td></tr><tr><th>State / UT</th><td>${esc0(r.state||'')}</td></tr><tr><th>ARN</th><td>${esc0(r.arn)}</td></tr><tr><th>Current Status</th><td>${r.status==='Approved'?'<span class="gst-status green">Approved</span>':'<span class="gst-status orange">Pending for Processing</span>'}</td></tr></table><div class="gst-section-title">Application Timeline</div><table class="gst-table"><tbody>${stages.map(s=>`<tr><td style="width:55px;text-align:center;font-size:20px">${s[1]?'✓':'○'}</td><td>${s[0]}</td><td>${s[1]?'Completed':'Pending'}</td></tr>`).join('')}</tbody></table>${r.status==='Pending for Processing'?'<div class="gst-alert warning">The real portal can keep an application pending for processing while the tax officer processes it. This offline simulator cannot perform that government processing. Use the training-only approval control to continue the end-to-end journey.</div><button class="gst-action" onclick="window.simulateRegistrationApproval()">SIMULATE PROCESSING / APPROVAL</button>':''}${r.status==='Approved'?`<div class="gst-alert success"><b>Registration approved.</b> Simulated GSTIN: ${esc0(r.gstin)}</div><button class="gst-action" onclick="window.gstProceedToLogin()">PROCEED TO LOGIN</button>`:''}`);
  };

  // Login gate: only an approved registration can enter the taxpayer dashboard in this training journey.
  window.openModal=function(type){
    if(type!=='login')return _openModal(type);
    const bg=document.getElementById('modalBg'),title=document.getElementById('modalTitle'),body=document.getElementById('modalBody');
    const r=registration();
    if(!r.arn){title.textContent='Taxpayer Login';body.innerHTML=`<div class="gst-alert warning"><b>No registered taxpayer is available in this training session.</b><br>Complete New Registration first. A taxpayer dashboard is created only after the simulated registration is approved.</div><div class="modal-actions"><button class="primary" onclick="closeModal();openFeature('new-registration')">START NEW REGISTRATION</button><button class="secondary" onclick="closeModal()">CLOSE</button></div>`;bg.style.display='flex';return;}
    if(r.status!=='Approved'){title.textContent='Taxpayer Login';body.innerHTML=`<div class="gst-alert warning"><b>Registration status: ${esc0(r.status)}</b><br>Login is unavailable until the registration application is approved. This prevents the simulator from opening a fake taxpayer dashboard before GSTIN issuance.</div><div class="modal-actions"><button class="primary" onclick="closeModal();track('track-registration')">TRACK APPLICATION</button><button class="secondary" onclick="closeModal()">CLOSE</button></div>`;bg.style.display='flex';return;}
    const captcha=typeof gstLoginCaptcha==='function'?gstLoginCaptcha():String(Math.floor(1000+Math.random()*9000));sessionStorage.setItem('gstLoginCaptcha',captcha);
    title.textContent='Taxpayer Login';
    body.innerHTML=`<div class="gst-login-section"><h4>Login</h4><div class="gst-field"><label>Username</label><input id="gstLoginUser" autocomplete="username" placeholder="Enter username"></div><div class="gst-field"><label>Password</label><input id="gstLoginPass" type="password" autocomplete="current-password" placeholder="Enter password"></div><div class="gst-field"><label>Captcha</label><div class="gst-captcha"><span class="gst-captcha-code">${captcha}</span><button type="button" class="secondary" onclick="window.openModal('login')">↻</button><input id="gstLoginCaptchaInput" maxlength="4" placeholder="Enter captcha"></div></div><div class="gst-login-links"><a href="#" onclick="event.preventDefault();window.gstOpenFirstTimeLogin()">First time login: If you are logging in for the first time, click here to login</a><br><a href="#" onclick="event.preventDefault();notify('Training simulator: use the registered GSTIN and temporary password shown in the approval credential notice.')">Forgot Username</a> &nbsp; | &nbsp; <a href="#" onclick="event.preventDefault();notify('Training simulator: use the registered GSTIN and temporary password shown in the approval credential notice.')">Forgot Password</a></div></div><div class="gst-alert info"><b>Registered Taxpayer</b><br>GSTIN: ${esc0(r.gstin)}<br>Legal Name: ${esc0(r.legalName||'')}<br>Status: Active</div><div id="gstLoginMsg" class="demo-note"></div><div class="modal-actions"><button class="primary" onclick="gstSubmitLogin()">LOGIN</button><button class="secondary" onclick="closeModal()">CLOSE</button></div>`;
    bg.style.display='flex';
  };

  window.gstOpenFirstTimeLogin=function(){
    const r=registration();
    if(!r.arn||r.status!=='Approved'){notify('Registration must be approved first.');return;}
    const bg=document.getElementById('modalBg'); if(bg) bg.style.display='none';
    const main=document.querySelector('.main'); if(!main)return;
    const captcha=String(Math.floor(1000+Math.random()*9000)); sessionStorage.setItem('gstFirstLoginCaptcha',captcha);
    main.innerHTML=`<div class="content"><div class="reg-breadcrumb"><span>Home</span> › <span>Login</span> › <span>First Time Login</span></div><div class="reg-page"><div class="reg-title-row"><div class="reg-title">First Time Login</div><div class="reg-mand"><b>*</b> mandatory</div></div><div class="gst-alert info"><b>First-time login</b><br>Enter the GSTIN/temporary username and temporary password communicated after registration approval. After successful verification, the portal will ask you to create your permanent username and password.</div><div class="reg-form"><label class="field">GSTIN / Temporary Username <b>*</b></label><input id="firstTempUser" value="${esc0(r.gstin||r.username||'')}" autocomplete="username"><label class="field">Temporary Password <b>*</b></label><input id="firstTempPass" type="password" autocomplete="current-password"><label class="field">Captcha <b>*</b></label><div class="gst-captcha"><span class="gst-captcha-code">${captcha}</span><input id="firstTempCaptcha" maxlength="4" placeholder="Enter captcha"></div><div class="modal-actions"><button class="primary" onclick="window.gstVerifyFirstTimeLogin()">LOGIN</button><button class="secondary" onclick="window.openModal('login')">BACK TO LOGIN</button></div><div id="firstTempMsg" class="demo-note"></div></div><div class="gst-alert warning"><b>Training simulator credential notice</b><br>Temporary username: <b>${esc0(r.gstin||r.username||'')}</b><br>Temporary password: <b>${esc0(r.tempPassword||'')}</b><br>In the real portal, these credentials are communicated to the registered contact; this simulator displays them locally so the training flow is testable.</div></div></div>`;
  };
  window.gstVerifyFirstTimeLogin=function(){
    const r=registration(),u=document.getElementById('firstTempUser')?.value.trim().toUpperCase(),p=document.getElementById('firstTempPass')?.value,c=document.getElementById('firstTempCaptcha')?.value.trim(),expected=sessionStorage.getItem('gstFirstLoginCaptcha'),m=document.getElementById('firstTempMsg');
    if(u!==(r.gstin||r.username||'').toUpperCase()||p!==r.tempPassword){m.innerHTML='<span style="color:#9a2f2f">Invalid temporary GSTIN/username or temporary password.</span>';return}
    if(c!==expected){m.innerHTML='<span style="color:#9a2f2f">Captcha does not match.</span>';return}
    r.firstLogin=true;write('gstRegistration',r);localStorage.setItem('gstLoggedIn','1');openFirstTimeLoginSetup();
  };

  window.gstSubmitLogin=function(){
    const r=registration(),u=document.getElementById('gstLoginUser')?.value.trim(),p=document.getElementById('gstLoginPass')?.value,c=document.getElementById('gstLoginCaptchaInput')?.value.trim(),expected=sessionStorage.getItem('gstLoginCaptcha'),msg=document.getElementById('gstLoginMsg');
    if(!r.arn||r.status!=='Approved'){msg.innerHTML='<span style="color:#9a2f2f">Registration is not approved. Login is unavailable.</span>';return}
    if(!u||!p||!c){msg.innerHTML='<span style="color:#9a2f2f">Please enter Username, Password and Captcha.</span>';return}
    if(c!==expected){msg.innerHTML='<span style="color:#9a2f2f">Captcha does not match.</span>';return}
    if(r.firstLogin){msg.innerHTML='<span style="color:#9a2f2f">This taxpayer has not completed First Time Login. Click the First Time Login link below.</span>';return} if(u!==r.username||p!==r.password){msg.innerHTML='<span style="color:#9a2f2f">Invalid taxpayer credentials for this registration.</span>';return}
    localStorage.setItem('gstLoggedIn','1');localStorage.setItem('gstLoginTime',new Date().toISOString());
    // If login was opened from an internal portal page (for example Track Application),
    // close that full-screen layer before rendering the next workflow screen.
    try{ if(document.getElementById('featureBg')?.style.display==='flex') closeFeature(); }catch(e){}
    if(r.firstLogin){closeModal();openFirstTimeLoginSetup();}else{closeModal();openTaxpayerDashboard();}
  };

  window.openFirstTimeLoginSetup=function(){
    const r=registration();const main=document.querySelector('.main');if(!main)return;
    main.innerHTML=`<div class="content"><div class="reg-breadcrumb"><span>Home</span> › <span>First Time Login</span></div><div class="reg-page"><div class="reg-title-row"><div class="reg-title">First Time Login</div><div class="reg-mand"><b>*</b> mandatory</div></div><div class="gst-alert info">Your temporary credentials have been verified. Set your own username and password to complete the first-time login process.</div><div class="reg-form"><label class="field">New Username <b>*</b></label><input id="firstUser" value="${esc0(r.username)}" minlength="4"><label class="field">New Password <b>*</b></label><input id="firstPass" type="password" placeholder="Create a password"><label class="field">Confirm Password <b>*</b></label><input id="firstPass2" type="password" placeholder="Re-enter password"><div class="modal-actions"><button class="primary" onclick="completeFirstTimeLogin()">CONTINUE TO TAXPAYER DASHBOARD</button></div><div id="firstLoginMsg" class="demo-note"></div></div></div></div>`;
  };
  window.completeFirstTimeLogin=function(){
    const r=registration(),u=document.getElementById('firstUser')?.value.trim(),p=document.getElementById('firstPass')?.value,p2=document.getElementById('firstPass2')?.value,m=document.getElementById('firstLoginMsg');
    if(!u||u.length<4||!p||p.length<8||p!==p2){m.innerHTML='<span style="color:#9a2f2f">Enter a username and a matching password of at least 8 characters.</span>';return}
    r.username=u;r.password=p;r.firstLogin=false;r.credentialsActivatedAt=new Date().toISOString();delete r.tempPassword;write('gstRegistration',r);localStorage.setItem('gstLoggedIn','1');
    openTaxpayerDashboard();
  };

  // Session guard: never overwrite registered taxpayer details with GST_DEMO.
  window.gstEnsureSession=function(){
    if(!localStorage.getItem('gstLoginTime'))localStorage.setItem('gstLoginTime',new Date().toISOString());
    const r=registration();
    if(r.status==='Approved'){
      const p=read('gstTaxpayer',{});p.gstin=r.gstin;p.legalName=r.legalName||p.legalName;p.tradeName=r.tradeName||p.tradeName;p.state=r.state||p.state;p.registrationStatus='Active';p.arn=r.arn;write('gstTaxpayer',p);
    }
  };

  window.openTaxpayerDashboard=function(){if(!gstLoggedIn()){openModal('login');return}const r=registration();if(r.status!=='Approved'){openModal('login');return}if(r.firstLogin){openFirstTimeLoginSetup();return}gstEnsureSession();feature('Taxpayer Dashboard','Dashboard',gstDashboardBody());};

  // Dashboard uses actual registration details and shared ledger state; no hard-coded balances or fake taxpayer identity.
  window.gstDashboardBody=function(){
    const p=read('gstTaxpayer',{}),r=registration();
    let cash=0,credit=0,liability=0;
    try{const x=read('gstLedgerEngineV2',null);if(x){for(const h of ['igst','cgst','sgst','cess']){for(const m of ['tax','interest','penalty','fee','others'])cash+=Number(x.cash?.[h]?.[m]||0);liability+=Number(x.liability?.[h]?.[m]||0); }credit+=Number(x.credit?.[h]||0);}}catch(e){}
    const filed=read('gstFiledReturnsTraining',[]).filter(x=>x.status==='Filed').length;
    return `<div class="gst-dash-head"><h2>Taxpayer Dashboard</h2><div class="gst-dash-meta"><span>GSTIN: <b>${esc0(p.gstin||r.gstin||'')}</b></span><span>Legal Name: <b>${esc0(p.legalName||r.legalName||'')}</b></span><span>Trade Name: <b>${esc0(p.tradeName||r.tradeName||'')}</b></span><span>Status: <b>Active</b></span><span>Taxpayer Type: <b>${esc0(p.taxpayerType||'Regular')}</b></span></div></div><div class="gst-alert success"><b>Registration active.</b> Your dashboard is available because the registration application has reached Approved status in this training simulation.</div><div class="gst-alert info">Use <b>Services → Returns → Returns Dashboard</b> to prepare and file returns. All balances below come from the simulator's shared ledger state.</div><div class="gst-summary-grid"><div class="gst-summary"><div class="label">Cash Balance</div><div class="value">₹${cash.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</div><div class="sub">Electronic Cash Ledger</div></div><div class="gst-summary"><div class="label">ITC Balance</div><div class="value">₹${credit.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</div><div class="sub">Electronic Credit Ledger</div></div><div class="gst-summary"><div class="label">Outstanding Liability</div><div class="value">₹${liability.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</div><div class="sub">Electronic Liability Register</div></div><div class="gst-summary"><div class="label">Filed Returns</div><div class="value">${filed}</div><div class="sub">Current simulator history</div></div></div><div class="gst-section-title">Taxpayer Services</div><div class="gst-tile-grid"><div class="gst-return-tile"><div class="rt-head">Returns</div><div class="rt-body"><div class="rt-row"><span>Returns Dashboard</span><b>Open</b></div><div class="rt-actions"><button class="gst-action" onclick="openReturnsDashboard()">OPEN RETURNS DASHBOARD</button></div></div></div><div class="gst-return-tile"><div class="rt-head">Registration</div><div class="rt-body"><div class="rt-row"><span>Registration Status</span><b>Active</b></div><div class="rt-actions"><button class="gst-action secondary" onclick="track('track-registration')">VIEW STATUS</button></div></div></div><div class="gst-return-tile"><div class="rt-head">Ledgers</div><div class="rt-body"><div class="rt-row"><span>Cash / Credit / Liability</span><b>View</b></div><div class="rt-actions"><button class="gst-action secondary" onclick="featureNav('Electronic Cash Ledger')">VIEW LEDGERS</button></div></div></div></div>`;
  };

  // Prevent login/session access before approval.
  window.gstRequireLogin=function(target){if(!localStorage.getItem('gstLoggedIn')){notify('Please complete and approve GST registration before login.');openModal('login');return false}const r=registration();if(r.status!=='Approved'){notify('Registration is not approved yet.');openModal('login');return false}return true};

  // Robust transition from the full-screen application layer to taxpayer login.
  // The login modal is moved to the document root and the application layer is
  // closed first, preventing any overlay from intercepting the click.
  window.gstProceedToLogin=function(){
    try{
      if(typeof closeFeature==='function') closeFeature();
      const bg=document.getElementById('modalBg');
      if(bg){
        if(bg.parentElement!==document.body) document.body.appendChild(bg);
        bg.style.zIndex='999999';
        bg.style.display='flex';
        document.body.style.overflow='hidden';
      }
      setTimeout(function(){
        if(typeof window.openModal==='function') window.openModal('login');
      },30);
    }catch(e){
      console.error('Login transition failed:',e);
      if(typeof notify==='function') notify('Unable to open login. Please try again.');
    }
  };

  window.currentRegisteredTaxpayer=function(){return read('gstTaxpayer',{});};

// Remove the old hard-coded application status if there is no real registration state.
  if(!registration().arn){localStorage.removeItem('gstApplicationStatus');localStorage.removeItem('gstARN');localStorage.removeItem('gstLoggedIn');localStorage.removeItem('gstLoginTime');localStorage.removeItem('gstTaxpayer');localStorage.removeItem('gstLedgerEngineV2');localStorage.removeItem('gstCashLedgerTraining');}
})();



/* ===== COMPLETE REGISTRATION AUTHENTICATION WORKFLOW PATCH ===== */
(function(){
  "use strict";

  const _partBTabComplete = window.partBTab;
  const _submitPartBFinalComplete = window.submitPartBFinal;

  function regRead(key, fallback){
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch(e){ return fallback; }
  }
  function regWrite(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
  function regEsc(v){
    return String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }
  function regApp(){
    if(typeof registration === "function") return registration();
    return regRead('gstRegistration',{});
  }
  function regPartB(){
    if(typeof partBData === "function") partBData();
    return regRead('gstPartBData',{});
  }
  function regPartA(){ return regRead('gstPartA',{}); }

  function renderAadhaarTab(){
    const d=regPartB(), a=regPartA();
    const constitution=d.constitution || 'Proprietorship';
    const signName=[d.signFirst,d.signMiddle,d.signLast].filter(Boolean).join(' ') || 'Primary Authorized Signatory';
    const promoterName=[d.personFirst,d.personMiddle,d.personLast].filter(Boolean).join(' ') || 'Promoter / Partner';
    const selected=d.aadhaarConsent==='Yes';
    const status=d.aadhaarAuthStatus||'Not Started';

    const panel=document.getElementById('partBPanel');
    if(!panel) return;

    panel.innerHTML=`
      <section class="pb-section">
        <h3>26. Aadhaar Authentication</h3>
        <div class="pb-note">
          Aadhaar authentication is an online verification step in the GST registration workflow.
          This training simulator uses demo identities/OTP only and never contacts UIDAI.
        </div>

        <div class="pb-grid">
          <label class="field">Would you like to opt for Aadhaar Authentication?</label>
          <div class="yesno">
            <label><input type="radio" name="aadhaarConsent" value="Yes" ${selected?'checked':''}> Yes</label>
            <label><input type="radio" name="aadhaarConsent" value="No" ${!selected?'checked':''}> No</label>
          </div>

          <div class="full">
            <div class="gst-alert ${selected?'info':'warning'}">
              ${selected
                ? '<b>Yes selected.</b> The applicable authorized signatory / promoter-partner authentication checkpoint will be completed before the application proceeds to its final registration state.'
                : '<b>No selected.</b> The simulator will follow the non-Aadhaar path and keep the application available for the officer-processing stage.'}
            </div>
          </div>

          <div class="full">
            <table class="gst-table" style="width:100%">
              <thead><tr><th>Person</th><th>Role</th><th>Authentication</th></tr></thead>
              <tbody>
                <tr><td>${regEsc(signName)}</td><td>Primary Authorized Signatory</td><td><span class="reg-auth-status ${status==='Success'?'success':'pending'}">${regEsc(status==='Success'?'Authenticated':selected?'Pending Authentication':'Not Required')}</span></td></tr>
                <tr><td>${regEsc(promoterName)}</td><td>${/partnership|llp|company|hindu/i.test(constitution)?'Promoter / Partner':'Applicant / Stakeholder'}</td><td><span class="reg-auth-status ${status==='Success'?'success':'pending'}">${regEsc(status==='Success'?'Authenticated':selected?'Pending Authentication':'Not Required')}</span></td></tr>
              </tbody>
            </table>
          </div>

          <div class="full">
            <div class="demo-note">
              Current GSTN guidance requires Aadhaar authentication for the applicable persons based on the constitution of business. The simulator represents that checkpoint with demo OTP and status transitions.
            </div>
          </div>
        </div>
      </section>`;

    panel.querySelectorAll('input[name="aadhaarConsent"]').forEach(el=>{
      el.addEventListener('change',()=>{
        const current=regPartB();
        current.aadhaarConsent=el.checked?el.value:current.aadhaarConsent;
        regWrite('gstPartBData',current);
        renderAadhaarTab();
      });
    });
  }

  // Note: the richer Aadhaar Authentication tab (matching the GST REG-01 table of
  // Promoter/Partner + Primary Authorized Signatory rows) is rendered directly by
  // partBTab() itself, so partBTab is intentionally left unwrapped here.

  function showAuthShell(title, breadcrumb, body){
    const main=document.querySelector('.main');
    if(!main) return;
    main.innerHTML=`
      <div class="content reg-auth-page">
        <div class="reg-breadcrumb"><span>Home</span> › <span>Registration</span> › <span>${regEsc(breadcrumb)}</span></div>
        <div class="reg-auth-shell">
          <div class="reg-auth-head">${regEsc(title)}</div>
          <div class="reg-auth-body">${body}</div>
        </div>
      </div>`;
    document.body.classList.add('registration-mode');
  }

  window.startRegistrationAadhaarAuthentication=function(){
    const d=regPartB(), a=regPartA();
    const sig0=(d.signatoryList||[])[0]||{}, promo0=(d.promotersList||[])[0]||{};
    const signName=[sig0.First,sig0.Middle,sig0.Last].filter(Boolean).join(' ') || 'Primary Authorized Signatory';
    const promoterName=[promo0.First,promo0.Middle,promo0.Last].filter(Boolean).join(' ') || 'Promoter / Partner';
    const otp=String(Math.floor(100000+Math.random()*900000));
    sessionStorage.setItem('gstAadhaarDemoOtp',otp);
    d.aadhaarAuthStatus='Pending';
    regWrite('gstPartBData',d);

    showAuthShell('Aadhaar Authentication', 'Aadhaar Authentication', `
      <div class="reg-timeline">
        <div class="step done">Part A</div>
        <div class="step done">TRN Login</div>
        <div class="step done">Part B</div>
        <div class="step current">Aadhaar Authentication</div>
        <div class="step">ARN / Processing</div>
      </div>
      <div class="gst-alert info"><b>Authentication link opened for the training applicant.</b><br>Complete the simulated Aadhaar OTP verification for all applicable selected persons.</div>
      <div class="reg-auth-grid">
        <div class="reg-auth-card">
          <h4>Primary Authorized Signatory</h4>
          <div><b>${regEsc(signName)}</b></div>
          <div class="demo-note">Demo Aadhaar authentication identity — no real Aadhaar is transmitted.</div>
          <label class="field">Common Aadhaar OTP <b>*</b></label>
          <input id="aadhaarOtp1" class="f-input" maxlength="6" inputmode="numeric" placeholder="Enter 6-digit OTP">
          <div class="reg-auth-otp">DEMO OTP: ${otp}</div>
        </div>
        <div class="reg-auth-card">
          <h4>Promoter / Partner</h4>
          <div><b>${regEsc(promoterName)}</b></div>
          <div class="demo-note">Training-only second applicable person checkpoint.</div>
          <label class="field">Authentication Status</label>
          <div class="reg-auth-status pending">Pending</div>
        </div>
      </div>
      <div id="aadhaarAuthMsg" class="demo-note" style="margin-top:14px"></div>
      <div class="reg-auth-actions">
        <button class="reg-proceed" onclick="verifyRegistrationAadhaar()">VALIDATE AADHAAR OTP</button>
        <button class="reg-back-btn" onclick="openTRNPartB()">BACK TO PART-B</button>
      </div>
      <div class="demo-note trn-demo-note">Training simulator: OTP and Aadhaar result are simulated locally. No UIDAI/GSTN request is made.</div>
    `);
  };

  window.verifyRegistrationAadhaar=function(){
    const entered=document.getElementById('aadhaarOtp1')?.value.trim();
    const expected=sessionStorage.getItem('gstAadhaarDemoOtp');
    const msg=document.getElementById('aadhaarAuthMsg');
    if(!entered || entered!==expected){
      if(msg) msg.innerHTML='<span style="color:#9a2f2f"><b>Invalid OTP.</b> Enter the displayed demo OTP.</span>';
      return;
    }
    const d=regPartB();
    d.aadhaarAuthStatus='Success';
    d.aadhaarAuthenticatedAt=new Date().toISOString();
    regWrite('gstPartBData',d);
    if(msg) msg.innerHTML='<span style="color:#176b35"><b>Aadhaar authentication completed successfully.</b></span>';
    setTimeout(()=>completeRegistrationSubmission('Aadhaar + EVC'),350);
  };

  function showEvcDsc(method){
    const r=regApp(), a=regPartA(), d=regPartB();
    if(method==='EVC'){
      const otp=String(Math.floor(100000+Math.random()*900000));
      sessionStorage.setItem('gstRegistrationEvcOtp',otp);
      showAuthShell('Submit Application with EVC', 'Verification › EVC Authentication', `
        <div class="reg-timeline">
          <div class="step done">Part A</div><div class="step done">TRN Login</div><div class="step done">Part B</div><div class="step current">EVC</div><div class="step">ARN / Processing</div>
        </div>
        <div class="gst-alert info"><b>Application Verification</b><br>The authorized signatory must authenticate the application using the registered mobile/email OTP.</div>
        <div class="reg-auth-card">
          <h4>Registered Authorized Signatory</h4>
          <p><b>${regEsc((()=>{const s=(d.signatoryList||[])[0]||{};return [s.First,s.Middle,s.Last].filter(Boolean).join(' ')||'Primary Authorized Signatory';})())}</b></p>
          <p>Email: ${regEsc(a.email||'')}</p>
          <p>Mobile: +91 ${regEsc(a.mobile||'')}</p>
          <label class="field">EVC OTP <b>*</b></label>
          <input id="registrationEvcOtpInput" class="f-input" maxlength="6" inputmode="numeric" placeholder="Enter 6-digit OTP">
          <div class="reg-auth-otp">DEMO OTP: ${otp}</div>
        </div>
        <div id="registrationEvcMsg" class="demo-note" style="margin-top:14px"></div>
        <div class="reg-auth-actions">
          <button class="reg-proceed" onclick="validateRegistrationEvc()">VALIDATE OTP</button>
          <button class="reg-back-btn" onclick="openTRNPartB()">BACK TO APPLICATION</button>
        </div>
        <div class="demo-note trn-demo-note">Training-only EVC. Real GST Portal EVC is not contacted.</div>
      `);
    }else{
      showAuthShell('Submit Application with DSC', 'Verification › DSC Authentication', `
        <div class="reg-timeline">
          <div class="step done">Part A</div><div class="step done">TRN Login</div><div class="step done">Part B</div><div class="step current">DSC</div><div class="step">ARN / Processing</div>
        </div>
        <div class="gst-alert info"><b>Digital Signature Certificate</b><br>Select the training certificate and complete the simulated signing sequence.</div>
        <div class="reg-auth-card">
          <h4>Certificate Store</h4>
          <select id="dscCertificate" class="f-select">
            <option value="">Select Certificate</option>
            <option>Training DSC — Authorized Signatory</option>
          </select>
          <div id="dscMsg" class="demo-note" style="margin-top:10px"></div>
        </div>
        <div class="reg-auth-actions">
          <button class="reg-proceed" onclick="validateRegistrationDsc()">SIGN & SUBMIT</button>
          <button class="reg-back-btn" onclick="openTRNPartB()">BACK TO APPLICATION</button>
        </div>
        <div class="demo-note trn-demo-note">Training-only DSC. No real certificate store or signing service is accessed.</div>
      `);
    }
  }

  window.validateRegistrationEvc=function(){
    const entered=document.getElementById('registrationEvcOtpInput')?.value.trim();
    const expected=sessionStorage.getItem('gstRegistrationEvcOtp');
    const msg=document.getElementById('registrationEvcMsg');
    if(!entered || entered!==expected){
      if(msg) msg.innerHTML='<span style="color:#9a2f2f"><b>Invalid OTP.</b> Enter the displayed demo OTP.</span>';
      return;
    }
    window.gstShowLoader('Verifying OTP...');
    setTimeout(()=>{ completeRegistrationSubmission('EVC'); window.gstHideLoader(); },window.gstRandomDelay());
  };

  window.validateRegistrationDsc=function(){
    const cert=document.getElementById('dscCertificate')?.value;
    const msg=document.getElementById('dscMsg');
    if(!cert){
      if(msg) msg.innerHTML='<span style="color:#9a2f2f">Select the training DSC certificate first.</span>';
      return;
    }
    if(msg) msg.innerHTML='<span style="color:#176b35"><b>Certificate verified.</b> Signing application...</span>';
    setTimeout(()=>completeRegistrationSubmission('DSC'),500);
  };

  window.completeRegistrationSubmission=function(method){
    const d=regPartB(), a=regPartA();
    const arn='AA32'+new Date().getFullYear()+Math.random().toString(36).slice(2,10).toUpperCase();
    const r=regApp();
    const aadhaarStatus=d.aadhaarOptIn==='Yes'?'Authenticated':'Not Opted';
    const updated={
      ...r, arn, status:'Pending for Processing', submittedAt:new Date().toISOString(), method,
      legalName:a.legalName||r.legalName||'', tradeName:d.tradeName||r.tradeName||'', pan:a.pan||r.pan||'',
      state:d.prinState||a.state||r.state||'', email:a.email||r.email||'', mobile:a.mobile||r.mobile||'',
      trn:localStorage.getItem('gstTRN')||r.trn||'', aadhaarStatus, workflowStage:'ARN Generated',
      timeline:{partA:true,trnLogin:true,partB:true,aadhaar:d.aadhaarOptIn==='Yes',verification:true,submission:true,arn:true,processing:false,approved:false}
    };
    regWrite('gstRegistration',updated);
    localStorage.setItem('gstARN',arn);
    localStorage.setItem('gstApplicationStatus','Pending for Processing');

    showAuthShell('Application Submitted', 'Registration › ARN Generated', `
      <div class="reg-timeline">
        <div class="step done">Part A</div><div class="step done">TRN Login</div><div class="step done">Part B</div><div class="step done">Verification</div><div class="step current">ARN Generated</div><div class="step">Processing</div>
      </div>
      <div class="gst-alert success"><b>Application submitted successfully.</b><br>The simulator has recorded the submission and generated a training ARN.</div>
      <table class="gst-table" style="width:100%">
        <tr><th>FORM</th><td><b>GST REG-01</b></td></tr><tr><th>ARN</th><td><b>${regEsc(arn)}</b></td></tr>
        <tr><th>Legal Name</th><td>${regEsc(updated.legalName)}</td></tr><tr><th>State / UT</th><td>${regEsc(updated.state)}</td></tr>
        <tr><th>Submission Method</th><td>${regEsc(method)}</td></tr><tr><th>Aadhaar Status</th><td>${regEsc(aadhaarStatus)}</td></tr>
        <tr><th>Current Status</th><td><span class="reg-auth-status pending">Pending for Processing</span></td></tr>
      </table>
      <div class="gst-alert info" style="margin-top:14px"><b>Acknowledgement</b><br>In the real GST Portal, the acknowledgement/ARN is communicated to the registered email address and mobile number after successful submission.</div>
      <div class="gst-alert warning" style="margin-top:14px">This offline simulator cannot submit to GSTN or perform government processing. Use Track Application Status for the training-only post-submission journey.</div>
      <div class="reg-auth-actions"><button class="reg-proceed" onclick="track('track-registration')">TRACK APPLICATION STATUS</button><button class="reg-back-btn" onclick="openTRNPartB()">VIEW APPLICATION</button></div>
      <div class="demo-note trn-demo-note">Training-only ARN: ${regEsc(arn)}. No real GSTN transaction was created.</div>
    `);
  };

  window.submitPartBFinal=function(method){
    const d=regPartB();
    window.gstRegSubmitAttempted=true;
    const errs=typeof validatePartB==='function'?validatePartB():[];
    if(errs.length){
      const box=document.getElementById('partBGlobalMessage');
      if(box){
        box.className='reg-message error';
        box.innerHTML='<b>&#9888; Please complete the following before submission:</b><ul>'+errs.map(e=>`<li><a href="#" onclick="event.preventDefault();partBTab('${e.tab}')">${regEsc(e.msg)}</a></li>`).join('')+'</ul>';
        box.style.display='block';
      }
      // Jump to the first tab that has an error and highlight it in red so the
      // person can see exactly what is missing, then scroll the error box into view last.
      if(typeof partBTab==='function') partBTab(errs[0].tab);
      document.querySelectorAll('.partb-tabs button').forEach(btn=>{
        btn.classList.toggle('tab-has-error',errs.some(e=>e.tab===btn.dataset.tab));
      });
      if(typeof markRequiredFieldErrors==='function') markRequiredFieldErrors();
      setTimeout(()=>{const b=document.getElementById('partBGlobalMessage'); if(b) b.scrollIntoView({behavior:'smooth',block:'center'});},60);
      return;
    }
    document.querySelectorAll('.partb-tabs button').forEach(btn=>btn.classList.remove('tab-has-error'));
    if(method==='EVC'||method==='DSC'){
      if(d.aadhaarOptIn==='Yes' && d.aadhaarAuthStatus!=='Success'){
        startRegistrationAadhaarAuthentication();
        return;
      }
      showEvcDsc(method);
    }
  };

  // If the user clicks the Aadhaar tab again after authentication, keep the success state visible.
  window.showRegistrationVerification=function(){
    if(typeof partBTab==='function') partBTab('verification');
  };

})();

/* ===== FULL GST-STYLE TAXPAYER LOGIN SCREEN — TRAINING SIMULATOR ===== */
(function(){
  'use strict';

  function loginReg(){
    try { if(typeof registration==='function'){ const r=registration(); if(r && r.arn) return r; } } catch(e){}
    try { if(typeof regApp==='function'){ const r=regApp(); if(r && r.arn) return r; } } catch(e){}
    try { return JSON.parse(localStorage.getItem('gstRegistration')||'{}'); } catch(e){ return {}; }
  }
  function loginEsc(v){
    if(typeof esc0==='function') return esc0(v==null?'':String(v));
    if(typeof esc==='function') return esc(v==null?'':String(v));
    return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function loginCaptcha(){
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s='';
    for(let i=0;i<6;i++) s+=chars[Math.floor(Math.random()*chars.length)];
    return s;
  }
  function clearLayers(){
    try{ document.getElementById('featureBg').style.display='none'; }catch(e){}
    try{ document.getElementById('modalBg').style.display='none'; }catch(e){}
    try{ document.getElementById('otpOverlay').style.display='none'; }catch(e){}
    document.body.style.overflow='';
  }

  window.renderGSTTaxpayerLogin=function(){
    const main=document.querySelector('.main');
    if(!main) return;
    clearLayers();
    const r=loginReg();
    if(!r.arn){
      main.innerHTML='<div class="gst-login-page"><div class="gst-login-card"><div class="gst-login-head"><div><div class="gst-login-brand">Goods and Services Tax</div><div class="gst-login-sub">Taxpayer Login</div></div></div><div class="gst-login-body"><div class="gst-alert warning"><b>No approved registration found.</b><br>Complete the GST REG-01 training workflow before entering the taxpayer portal.</div><button class="gst-action" onclick="openFeature(\'new-registration\')">GO TO NEW REGISTRATION</button></div></div></div>';
      return;
    }
    if(r.status!=='Approved'){
      main.innerHTML=`<div class="gst-login-page"><div class="gst-login-card"><div class="gst-login-head"><div><div class="gst-login-brand">Goods and Services Tax</div><div class="gst-login-sub">Taxpayer Login</div></div></div><div class="gst-login-body"><div class="gst-alert warning"><b>Registration not yet approved.</b><br>Current status: <strong>${loginEsc(r.status||'Pending for Processing')}</strong></div><button class="gst-action" onclick="track('track-registration')">VIEW APPLICATION STATUS</button></div></div></div>`;
      return;
    }

    const captcha=loginCaptcha();
    sessionStorage.setItem('gstFullLoginCaptcha',captcha);
    const tempUser=r.username||'';
    const tempPass=r.firstLogin?(r.tempPassword||''):'';

    main.innerHTML=`
      <div class="gst-login-page">
        <div class="gst-login-breadcrumb">Home &nbsp;›&nbsp; Login &nbsp;›&nbsp; Taxpayer Login</div>
        <div class="gst-login-card">
          <div class="gst-login-head">
            <div>
              <div class="gst-login-brand">Goods and Services Tax</div>
              <div class="gst-login-sub">Taxpayer Login</div>
            </div>
            <div class="gst-login-head-right">GST Portal</div>
          </div>
          <div class="gst-login-body">
            <div class="gst-login-columns">
              <section class="gst-login-form-panel">
                <h2>Login</h2>
                <p class="gst-login-help">Enter your GST Portal User ID, Password and the characters shown below.</p>
                <div class="gst-real-field"><label for="gstFullLoginUser">Username <span>*</span></label><input id="gstFullLoginUser" type="text" autocomplete="username" placeholder="Enter Username"></div>
                <div class="gst-real-field"><label for="gstFullLoginPass">Password <span>*</span></label><input id="gstFullLoginPass" type="password" autocomplete="current-password" placeholder="Enter Password"></div>
                <div class="gst-real-field"><label>Captcha <span>*</span></label><div class="gst-real-captcha-row"><span id="gstFullCaptchaCode" class="gst-real-captcha-code">${captcha}</span><button type="button" class="gst-refresh-captcha" onclick="window.refreshGSTFullCaptcha()" aria-label="Refresh captcha">↻</button><input id="gstFullLoginCaptcha" type="text" maxlength="6" autocomplete="off" placeholder="Enter Captcha"></div></div>
                <div id="gstFullLoginMsg" class="gst-full-login-msg" role="alert"></div>
                <div class="gst-login-actions"><button type="button" class="gst-login-submit" onclick="window.submitGSTFullLogin()">LOGIN</button><button type="button" class="gst-login-reset" onclick="window.renderGSTTaxpayerLogin()">RESET</button></div>
                <div class="gst-login-links"><button type="button" onclick="window.gstLoginInfo('Forgot Username')">Forgot Username?</button><span>|</span><button type="button" onclick="window.gstLoginInfo('Forgot Password')">Forgot Password?</button></div>
              </section>
              <aside class="gst-login-side">
                <div class="gst-login-side-title">Registered Taxpayer</div>
                <div class="gst-login-side-box"><div><span>GSTIN</span><b>${loginEsc(r.gstin||'')}</b></div><div><span>Legal Name</span><b>${loginEsc(r.legalName||'')}</b></div><div><span>Status</span><b class="active">Active</b></div></div>
                ${r.firstLogin ? `<div class="gst-training-credentials"><div class="gst-training-title">Training credentials</div><p>This offline simulator generated temporary credentials for this registration.</p><div class="credential-row"><span>Username</span><strong>${loginEsc(tempUser)}</strong></div><div class="credential-row"><span>Temporary Password</span><strong>${loginEsc(tempPass)}</strong></div><small>Use these values for this training session. They are stored only in this browser and are not sent to GSTN.</small></div>` : `<div class="gst-login-note"><b>First-time setup completed.</b><br>Use the username and password you created during the simulator's first-time login step.</div>`}
                <div class="gst-login-note"><b>Training simulator</b><br>This screen models the GST taxpayer login sequence. It does not connect to or authenticate against the live GSTN service.</div>
              </aside>
            </div>
          </div>
        </div>
      </div>`;
  };

  window.refreshGSTFullCaptcha=function(){
    const c=loginCaptcha(); sessionStorage.setItem('gstFullLoginCaptcha',c);
    const el=document.getElementById('gstFullCaptchaCode'); if(el) el.textContent=c;
    const inp=document.getElementById('gstFullLoginCaptcha'); if(inp) inp.value='';
  };

  window.gstLoginInfo=function(type){
    const msg=document.getElementById('gstFullLoginMsg');
    if(!msg) return;
    if(type==='Forgot Username') msg.innerHTML='<div class="gst-login-info-box"><b>Forgot Username</b><br>For this training simulator, username recovery is represented as a local help step. A real GST Portal recovery uses the registered GSTIN/identifier and OTP verification.</div>';
    else msg.innerHTML='<div class="gst-login-info-box"><b>Forgot Password</b><br>For this training simulator, password recovery is represented as a local help step. A real GST Portal recovery uses the portal\'s password-reset flow and OTP verification.</div>';
  };

  window.submitGSTFullLogin=function(){
    const r=loginReg();
    // Trim both fields (a stray space from selecting/copying the credential
    // table text is an easy, invisible way to make an exact match fail) and
    // compare the username case-insensitively (GSTIN is shown in upper case,
    // but people often type it in lower case out of habit).
    const u=(document.getElementById('gstFullLoginUser')?.value||'').trim();
    const p=(document.getElementById('gstFullLoginPass')?.value||'').trim();
    const c=document.getElementById('gstFullLoginCaptcha')?.value.trim().toUpperCase()||'';
    const expected=sessionStorage.getItem('gstFullLoginCaptcha')||'';
    const msg=document.getElementById('gstFullLoginMsg');
    if(!u||!p||!c){msg.innerHTML='<div class="gst-login-error">Please enter Username, Password and Captcha.</div>';return;}
    if(c!==expected){msg.innerHTML='<div class="gst-login-error">Captcha does not match. Please enter the characters shown in the image.</div>';window.refreshGSTFullCaptcha();return;}
    const expectedPass=(r.firstLogin?(r.tempPassword||''):(r.password||'')).trim();
    const expectedUser=(r.username||'').trim();
    if(u.toUpperCase()!==expectedUser.toUpperCase()||p!==expectedPass){msg.innerHTML='<div class="gst-login-error">Invalid Username or Password. Use the training credentials shown on the right for this simulator.</div>';return;}
    window.gstShowLoader('Signing in...');
    setTimeout(()=>{
    localStorage.setItem('gstLoggedIn','1'); localStorage.setItem('gstLoginTime',new Date().toISOString());
    sessionStorage.removeItem('gstFullLoginCaptcha');
    if(r.firstLogin){
      if(typeof openFirstTimeLoginSetup==='function') openFirstTimeLoginSetup();
      else if(typeof window.openTaxpayerDashboard==='function') window.openTaxpayerDashboard();
    }else if(typeof window.openTaxpayerDashboard==='function'){
      window.openTaxpayerDashboard();
    }
    window.gstHideLoader();
    },4000);
  };

  // Route every simulator login entry point to the full-page login instead of the old modal.
  window.gstProceedToLogin=function(){
    window.gstShowLoader('Loading Login page...');
    setTimeout(function(){ window.renderGSTTaxpayerLogin(); window.gstHideLoader(); }, window.gstRandomDelay());
  };
  const _loginGateOpenModal=window.openModal;
  window.openModal=function(type){
    if(type==='login'){ window.gstProceedToLogin(); return; }
    if(type==='register'){ window.registrationPage(); return; }
    return _loginGateOpenModal(type);
  };
})();

/* ===== GST FILING ENGINE — GSTR-1 SUBMIT / FILE PASS ===== */
(function(){
  const _g1BodyBeforeFiling = gstGstr1Body;
  window.gstGstr1Submit = function(){
    const d=gstGstr1Data(), m=document.getElementById('gstGstr1Msg');
    if(d.status==='Filed'){ if(m)m.innerHTML='<span style="color:#176b35"><b>GSTR-1 is already filed for this period.</b></span>'; return; }
    if(d.status!=='Validated'){
      if(m)m.innerHTML='<span style="color:#9a2f2f"><b>Submit is unavailable.</b> Generate the latest summary and validate GSTR-1 first.</span>';
      return;
    }
    if(d.summaryGeneratedAt && d.lastDataChangeAt && new Date(d.lastDataChangeAt)>new Date(d.summaryGeneratedAt)){
      if(m)m.innerHTML='<span style="color:#9a2f2f"><b>Generate Summary again.</b> The return was changed after the last summary.</span>';
      return;
    }
    d.status='Submitted';
    d.submittedAt=new Date().toISOString();
    d.reference='GSTR1-SUB-'+Date.now().toString().slice(-10);
    d.audit=(d.audit||[]).concat([{at:d.submittedAt,action:'SUBMIT GSTR-1',reference:d.reference}]);
    gstSaveGstr1(d);
    if(m)m.innerHTML='<span style="color:#176b35"><b>GSTR-1 submitted successfully.</b><br>Reference: '+esc(d.reference)+'<br>Records are now frozen. Proceed to <b>FILE RETURN</b>.</span>';
    setTimeout(gstOpenGstr1,350);
  };

  window.gstGstr1FilePage = function(){
    const d=gstGstr1Data();
    if(d.status!=='Submitted'){
      feature('GSTR-1 — File Return','GSTR-1 > File Return',`<div class="gst-alert warning"><b>File Return is not available yet.</b><br>First generate the latest summary, validate and SUBMIT GSTR-1.</div><button class="gst-action secondary" onclick="gstOpenGstr1()">BACK</button>`);
      return;
    }
    const p=gstRead('gstTaxpayer',GST_DEMO)||GST_DEMO;
    feature('GSTR-1 — File Return','Services > Returns > Returns Dashboard > GSTR-1 > File Return',`
      <div class="gst-dash-head"><h2>File Form GSTR-1</h2><div class="gst-dash-meta"><span>FY: <b>${esc(gstReturnContext().fy)}</b></span><span>Period: <b>${esc(gstReturnContext().period)}</b></span><span>GSTIN: <b>${esc(p.gstin||'')}</b></span></div></div>
      <div class="gst-alert info"><b>Final filing stage</b><br>Review the return, select the Authorized Signatory and choose the applicable filing method.</div>
      <table class="gst-table"><tr><th>Submission Reference</th><td>${esc(d.reference||'')}</td><th>Status</th><td><span class="gst-status blue">Submitted</span></td></tr><tr><th>Summary Records</th><td>${(d.summary||gstGstr1Summary(d)).count}</td><th>Taxable Value</th><td>${gstMoney((d.summary||gstGstr1Summary(d)).taxable)}</td></tr></table>
      <div class="gst-section-title">Declaration</div>
      <label style="display:flex;gap:10px;align-items:flex-start;margin:14px 0"><input type="checkbox" id="g1FileDecl"> <span>I hereby solemnly affirm and declare that the information given in this return is true and correct to the best of my knowledge and belief.</span></label>
      <div class="gst-form-grid">
        <div><label>Authorized Signatory *</label><select id="g1FileSigner" class="f-select"><option value="">Select Authorized Signatory</option><option>Demo Authorized Signatory</option></select></div>
        <div><label>Filing Method *</label><select id="g1FileMode" class="f-select"><option value="EVC">FILE WITH EVC</option><option value="DSC">FILE WITH DSC</option></select></div>
      </div>
      <div class="gst-alert warning"><b>Training simulation:</b> EVC/DSC authentication is simulated locally. No GSTN credential, OTP, DSC certificate or government account is accessed.</div>
      <div class="gst-action-row"><button class="gst-action" onclick="gstGstr1FileStart()">PROCEED TO FILE</button><button class="gst-action secondary" onclick="gstGstr1Preview()">PREVIEW GSTR-1</button><button class="gst-action secondary" onclick="gstOpenGstr1()">BACK</button></div>
      <div id="g1FileMsg" class="demo-note"></div>`);
  };

  window.gstGstr1FileStart = function(){
    const d=gstGstr1Data(), msg=document.getElementById('g1FileMsg');
    const decl=document.getElementById('g1FileDecl')?.checked;
    const signer=document.getElementById('g1FileSigner')?.value||'';
    const mode=document.getElementById('g1FileMode')?.value||'EVC';
    if(d.status!=='Submitted'){if(msg)msg.innerHTML='<span style="color:#9a2f2f">Submit GSTR-1 before filing.</span>';return;}
    if(!decl||!signer){if(msg)msg.innerHTML='<span style="color:#9a2f2f">Declaration and Authorized Signatory are mandatory.</span>';return;}
    if(mode==='DSC'){
      feature('GSTR-1 — DSC Authentication','GSTR-1 > File Return > DSC',`<div class="gst-alert info"><b>Digital Signature Certificate</b><br>Select the certificate and sign the return.</div><div class="gst-form-grid"><div><label>Certificate *</label><select id="g1DscCert" class="f-select"><option value="">Select certificate</option><option>Demo Authorized Signatory — Training DSC</option></select></div></div><div class="gst-action-row"><button class="gst-action" onclick="gstGstr1FileWithDSC()">SIGN & FILE WITH DSC</button><button class="gst-action secondary" onclick="gstGstr1FilePage()">BACK</button></div><div id="g1DscMsg" class="demo-note"></div>`);
    } else {
      const otp=String(Math.floor(100000+Math.random()*900000));
      sessionStorage.setItem('gstG1FileOtp',otp);
      feature('GSTR-1 — EVC Authentication','GSTR-1 > File Return > EVC',`<div class="gst-alert info"><b>OTP sent to registered email and mobile of Authorized Signatory.</b><br><small>Training OTP: <b>${otp}</b></small></div><div class="gst-form-grid"><div><label>OTP *</label><input id="g1EvcOtp" class="f-input" inputmode="numeric" maxlength="6" placeholder="Enter 6-digit OTP"></div></div><div class="gst-action-row"><button class="gst-action" onclick="gstGstr1FileWithEVC()">VALIDATE OTP & FILE</button><button class="gst-action secondary" onclick="gstGstr1FilePage()">BACK</button></div><div id="g1EvcMsg" class="demo-note"></div>`);
    }
  };

  function finishG1File(mode){
    const d=gstGstr1Data(), now=new Date().toISOString();
    d.status='Filed'; d.filedAt=now; d.filingMode=mode; d.arn='AA'+Date.now().toString().slice(-12); d.audit=(d.audit||[]).concat([{at:now,action:'FILE GSTR-1',reference:d.arn,mode}]);
    gstSaveGstr1(d);
    feature('GSTR-1 — Filed Successfully','Services > Returns > View e-Filed Returns',`<div class="gst-alert success"><b>Form GSTR-1 filed successfully.</b><br>An acknowledgement/ARN has been generated in this training simulator.</div><table class="gst-table"><tr><th>Financial Year</th><td>${esc(gstReturnContext().fy)}</td><th>Return Period</th><td>${esc(gstReturnContext().period)}</td></tr><tr><th>Filing Mode</th><td>${esc(mode)}</td><th>Status</th><td><span class="gst-status green">Filed</span></td></tr><tr><th>ARN</th><td colspan="3"><b>${esc(d.arn)}</b></td></tr></table><div class="gst-alert info">Simulated filing acknowledgement: the return is now locked for this period.</div><div class="gst-action-row"><button class="gst-action" onclick="openReturnsDashboard()">BACK TO RETURNS DASHBOARD</button><button class="gst-action secondary" onclick="notify('Filed return PDF preview simulated')">VIEW FILED RETURN</button></div>`);
  }
  window.gstGstr1FileWithDSC=function(){const cert=document.getElementById('g1DscCert')?.value||'';const m=document.getElementById('g1DscMsg');if(!cert){if(m)m.innerHTML='<span style="color:#9a2f2f">Select a DSC certificate.</span>';return}finishG1File('DSC')};
  window.gstGstr1FileWithEVC=function(){const otp=document.getElementById('g1EvcOtp')?.value||'', expected=sessionStorage.getItem('gstG1FileOtp');const m=document.getElementById('g1EvcMsg');if(otp!==expected){if(m)m.innerHTML='<span style="color:#9a2f2f">Invalid OTP. Enter the OTP sent to the registered Authorized Signatory.</span>';return}sessionStorage.removeItem('gstG1FileOtp');finishG1File('EVC')};

  window.gstGstr1Body=function(){
    const html=_g1BodyBeforeFiling();
    const d=gstGstr1Data();
    let out=html.replace(/<button class="gst-action" onclick="gstGstr1Submit\(\)">SUBMIT<\/button>/,'<button class="gst-action" onclick="gstGstr1Submit()">SUBMIT</button> <button class="gst-action" onclick="gstGstr1FilePage()">FILE RETURN</button>');
    if(d.status==='Filed') out=out.replace(/<button class="gst-action" onclick="gstGstr1Submit\(\)">SUBMIT<\/button>\s*<button class="gst-action" onclick="gstGstr1FilePage\(\)">FILE RETURN<\/button>/,'<button class="gst-action secondary" onclick="notify(\'GSTR-1 is already filed for this period.\')">FILED</button>');
    return out;
  };
  const _oldOpenG1=window.gstOpenGstr1||gstOpenGstr1;
  window.gstOpenGstr1=function(){if(!gstRequireLogin('GSTR-1'))return;const c=gstReturnContext();localStorage.setItem('gstReturnFY',c.fy);localStorage.setItem('gstReturnPeriod',c.period);feature('GSTR-1 — Details of Outward Supplies','Services > Returns > Returns Dashboard > GSTR-1',window.gstGstr1Body());};
  gstOpenGstr1=window.gstOpenGstr1;
})();

/* ===== GSTR-1 FULL FILING FLOW — current GSTN-style training implementation ===== */
(function(){
  function d(){ const x=gstGstr1Data(); x.notes=x.notes||[]; x.advances=x.advances||[]; x.amendments=x.amendments||[]; x.documents=x.documents||[]; x.hsnB2B=x.hsnB2B||[]; x.hsnB2C=x.hsnB2C||[]; x.hsn=x.hsn||[];
    // Bug fix: this used to always rebuild x.hsn as [...hsnB2B, ...hsnB2C], which are two
    // arrays nothing in the app ever writes to (there's no Table-12 B2B/B2C split UI yet).
    // That silently threw away every HSN/SAC row saved via the real Table-12 form
    // (gstGstr1Hsn / gstAddGstr1Hsn), so GSTR-1 could never pass Table 12 validation.
    // Keep the legacy x.hsn array unless the split arrays actually have data in them.
    if(x.hsnB2B.length || x.hsnB2C.length) x.hsn=[...x.hsnB2B,...x.hsnB2C];
    x.summary=x.summary||null; return x; }
  function save(x){gstSaveGstr1(x)}
  function totalNotes(x){return (x.notes||[]).reduce((a,r)=>a+(+r.taxable||0),0)}
  function supplyCount(x){return (x.invoices||[]).length+(x.b2c||[]).length+(x.exports||[]).length+(x.notes||[]).length+(x.advances||[]).length}
  function hsnCount(x){return (x.hsnB2B||[]).length+(x.hsnB2C||[]).length || (x.hsn||[]).length}
  function docCount(x){return (x.documents||[]).length}
  function allTax(x){
    const arr=[...(x.invoices||[]),...(x.b2c||[]),...(x.exports||[]),...(x.notes||[]),...(x.advances||[])];
    return arr.reduce((a,r)=>{a.taxable+=(+r.taxable||0);a.igst+=(+r.igst||0);a.cgst+=(+r.cgst||0);a.sgst+=(+r.sgst||0);a.cess+=(+r.cess||0);return a},{taxable:0,igst:0,cgst:0,sgst:0,cess:0});
  }
  function tile(title,sub,count,fn){return `<div class="gst-portal-tile"><div class="portal-tile-head"><span>${title}</span><span class="portal-count">${count}</span></div><div class="portal-tile-body"><div class="portal-tile-sub">${sub}</div><div class="portal-tile-actions"><button class="gst-action" onclick="${fn}">ADD RECORD DETAILS</button></div></div></div>`}

  window.gstGstr1Body=function(){
    const c=gstReturnContext(),x=d(),t=allTax(x),st=x.status||'Draft',frozen=st==='Submitted'||st==='Filed',sup=supplyCount(x);
    const add=[
      tile('4A, 4B, 4C, 6B, 6C — B2B Invoices','Taxable outward supplies made to registered persons',x.invoices.length,'gstGstr1B2B()'),
      tile('5A, 5B — B2C (LARGE) INVOICES','Inter-State B2C invoices above ₹1 lakh for return periods from Aug-2024',x.b2c.filter(r=>r.type==='B2C Large').length,'gstGstr1B2CLarge()'),
      tile('6A — EXPORTS INVOICES','Exports with payment / without payment of IGST',x.exports.filter(r=>r.type==='Export').length,'gstGstr1Exports()'),
      tile('7 — B2C (OTHERS)','Other B2C outward supplies',x.b2c.filter(r=>r.type==='B2C Others').length,'gstGstr1B2COthers()'),
      tile('8A, 8B, 8C, 8D — NIL / EXEMPT / NON-GST','Nil-rated, exempt and non-GST outward supplies',x.b2c.filter(r=>r.type==='Nil / Exempt / Non-GST').length,'gstGstr1B2CNil()'),
      tile('9B — CREDIT / DEBIT NOTES (REGISTERED)','CDNR — notes issued to registered persons',x.notes.filter(r=>r.party==='Registered').length,"gstGstr1Notes('Registered')"),
      tile('9B — CREDIT / DEBIT NOTES (UNREGISTERED)','CDNUR / export notes, where applicable',x.notes.filter(r=>r.party==='Unregistered').length,"gstGstr1Notes('Unregistered')"),
      tile('11A — ADVANCES RECEIVED','Advances received on which tax is payable',x.advances.filter(r=>r.kind==='Received').length,"gstGstr1Advances('Received')"),
      tile('11B — ADJUSTMENT OF ADVANCES','Adjustment of advances against invoices',x.advances.filter(r=>r.kind==='Adjustment').length,"gstGstr1Advances('Adjustment')"),
      tile('12 — HSN/SAC SUMMARY','Separate B2B Supplies and B2C Supplies tabs',hsnCount(x),'gstGstr1Hsn()'),
      tile('13 — DOCUMENTS ISSUED','Document series and documents issued during the period',docCount(x),'gstGstr1Documents()'),
      tile('14 — SUPPLIES THROUGH ECO','Applicable e-commerce operator reporting',0,"gstGstr1Placeholder('14 — Supplies through ECO')"),
      tile('15 — SUPPLIES U/S 9(5)','Applicable section 9(5) reporting',0,"gstGstr1Placeholder('15 — Supplies u/s 9(5)')")
    ].join('');
    const amend=[
      tile('9A — AMENDED B2B / EXPORT','Amend previously furnished invoices',x.amendments.filter(r=>/^9A/.test(r.table||'')).length,"gstGstr1Amend('9A-B2B')"),
      tile('9C — AMENDED CREDIT / DEBIT NOTES','Amend previously furnished notes',x.amendments.filter(r=>/^9C/.test(r.table||'')).length,"gstGstr1Amend('9C-CDNR')"),
      tile('10 — AMENDED B2C','Amend previously furnished B2C supplies',x.amendments.filter(r=>r.table==='10-B2C').length,"gstGstr1Amend('10-B2C')"),
      tile('11A / 11B — AMENDED ADVANCES','Amend advances / adjustments',x.amendments.filter(r=>/^11/.test(r.table||'')).length,"gstGstr1Amend('11A')"),
      tile('14A / 15A — AMENDED ECO / 9(5)','Applicable amendments',x.amendments.filter(r=>/^14A|^15A/.test(r.table||'')).length,"gstGstr1Amend('14A')")
    ].join('');
    const action=frozen
      ? (st==='Filed'?`<div class="gst-alert success"><b>GSTR-1 is filed.</b><br>ARN: <b>${esc(x.arn||x.reference||'SIM-GSTR1')}</b><br>Filing date: ${esc(x.filedAt?new Date(x.filedAt).toLocaleString('en-IN'):'—')}</div><div class="gst-action-row"><button class="gst-action secondary" onclick="gstGstr1FiledReceipt()">VIEW ACKNOWLEDGEMENT</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK TO RETURNS DASHBOARD</button></div>`:
      `<div class="gst-alert info"><b>Submitted.</b> The GSTR-1 data is frozen. Proceed to final filing.</div><div class="gst-action-row"><button class="gst-action" onclick="gstGstr1FilePage()">PROCEED TO FILE GSTR-1</button><button class="gst-action secondary" onclick="gstGstr1Preview()">PREVIEW</button></div>`)
      : `<div class="gst-alert warning"><b>Before submission:</b> Save all applicable tables, generate the GSTR-1 summary, preview it, and validate the return. After SUBMIT, the period is frozen until final filing.</div><div class="gst-action-row"><button class="gst-action" onclick="gstGstr1GenerateSummary()">GENERATE GSTR-1 SUMMARY</button><button class="gst-action secondary" onclick="gstGstr1Preview()">PREVIEW</button><button class="gst-action" onclick="gstGstr1Validate()">VALIDATE</button><button class="gst-action" onclick="gstGstr1Submit()">SUBMIT</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK</button></div>`;
    const nilBanner=(!frozen && sup===0)?`<div class="gst-alert nil-banner"><b>No outward supplies to report this period?</b> You can file a <b>Nil GSTR-1</b> directly, without going through each table.<div class="gst-action-row" style="margin-top:8px"><button class="gst-action" onclick="gstGstr1NilFile()">FILE NIL GSTR-1</button></div></div>`:'';
    return `<div class="gst-portal-return-head"><div><div class="portal-kicker">FORM GSTR-1</div><h2>Details of outward supplies of goods or services</h2><div class="portal-meta"><span>Financial Year: <b>${esc(c.fy)}</b></span><span>Return Period: <b>${esc(c.period)}</b></span><span>GSTIN: <b>${esc(gstRead('gstTaxpayer',GST_DEMO).gstin)}</b></span><span>Status: <b>${esc(st)}</b></span></div></div><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK</button></div>
      <div class="gst-alert info"><b>GSTR-1</b><br>Details of outward supplies of goods or services. This training implementation follows the current GSTN-style ADD RECORD DETAILS / AMEND RECORD DETAILS structure.</div>
      ${nilBanner}
      <div class="gst-section-title">ADD RECORD DETAILS <span class="portal-section-note">${sup} record(s)</span></div><div class="gst-portal-grid">${add}</div>
      <div class="gst-section-title portal-collapsible" onclick="gstToggleAmend()">AMEND RECORD DETAILS <span id="g1AmendArrow">▼</span></div><div id="g1AmendPanel" class="gst-portal-grid" style="display:none">${amend}</div>
      <div class="gst-section-title">GSTR-1 SUMMARY</div><table class="gst-table gst-portal-table"><thead><tr><th>Particulars</th><th>Records</th><th>Taxable Value</th><th>IGST</th><th>CGST</th><th>SGST/UTGST</th><th>CESS</th></tr></thead><tbody><tr><td>Outward supplies</td><td>${sup}</td><td>${gstMoney(t.taxable)}</td><td>${gstMoney(t.igst)}</td><td>${gstMoney(t.cgst)}</td><td>${gstMoney(t.sgst)}</td><td>${gstMoney(t.cess)}</td></tr><tr><td>HSN/SAC</td><td>${hsnCount(x)}</td><td colspan="5">${hsnCount(x)?'Entered':'Not entered'}</td></tr><tr><td>Documents issued</td><td>${docCount(x)}</td><td colspan="5">${docCount(x)?'Entered':'Not entered'}</td></tr></tbody></table>
      <div class="gst-section-title">RETURN ACTIONS</div>${action}<div id="gstGstr1Msg" class="demo-note"></div>`;
  };

  window.gstGstr1Validate=function(){
    const x=d(),m=document.getElementById('gstGstr1Msg'),e=[];
    if(x.status==='Filed'){m.innerHTML='<span style="color:#176b35"><b>Return already filed.</b></span>';return true}
    if(!x.summary)e.push('Generate GSTR-1 Summary before validation.');
    const supplies=(x.invoices||[]).length+(x.b2c||[]).length+(x.exports||[]).length;
    if(supplies>0 && hsnCount(x)===0)e.push('Enter applicable HSN/SAC details in Table 12.');
    if(supplies>0 && docCount(x)===0)e.push('Enter Table 13 — Documents Issued. Table 13 is mandatory where applicable from May 2025 return periods.');
    for(const r of x.invoices||[]){if(!r.recipientGstin)e.push('B2B invoice has no recipient GSTIN.');if(!r.invoiceNo)e.push('B2B invoice number is missing.');if((+r.taxable||0)<=0)e.push('B2B taxable value must be greater than zero.');}
    for(const r of x.b2c||[]){if((+r.taxable||0)<0)e.push('B2C taxable value cannot be negative.');}
    if(e.length){m.innerHTML='<span style="color:#9a2f2f"><b>Validation failed.</b><ul>'+e.map(esc).map(v=>'<li>'+v+'</li>').join('')+'</ul></span>';return false}
    x.status='Validated';x.validatedAt=new Date().toISOString();save(x);m.innerHTML='<span style="color:#176b35"><b>Validation successful.</b> GSTR-1 is ready for submission.</span>';return true;
  };

  window.gstGstr1Submit=function(){
    const x=d(),m=document.getElementById('gstGstr1Msg');
    if(x.status!=='Validated'){m.innerHTML='<span style="color:#9a2f2f"><b>Submit is unavailable.</b> Generate Summary and complete validation first.</span>';return}
    x.status='Submitted';x.submittedAt=new Date().toISOString();x.reference='SIM-GSTR1-'+Date.now().toString().slice(-10);save(x);gstOpenGstr1();
    setTimeout(()=>{const box=document.getElementById('gstGstr1Msg');if(box)box.innerHTML='<span style="color:#176b35"><b>GSTR-1 submitted successfully.</b><br>Reference: '+esc(x.reference)+'<br>All return records are now frozen. Click PROCEED TO FILE GSTR-1.</span>'},50);
  };

  window.gstGstr1NilFile=function(){
    const x=d(),sup=supplyCount(x),c=gstReturnContext();
    if(sup>0){notify('This period has records added — Nil filing is only for periods with zero outward supplies. Remove all records first, or file normally.');return}
    feature('GSTR-1 — Nil Return','Services > Returns > Returns Dashboard > GSTR-1 > File Nil Return',`
      <div class="gst-pagebar"><div><b>File Nil GSTR-1</b><div class="muted">${esc(c.period)} — no outward supplies to report</div></div><button class="gst-action secondary" onclick="gstOpenGstr1()">BACK</button></div>
      <div class="gst-alert info"><b>Nil Return</b><br>You can file GSTR-1 as Nil if you have not made any outward supply (including nil-rated, exempt or non-GST supply), and have no debit/credit notes, advances, or amendments to declare for this period.</div>
      <table class="gst-table gst-portal-table"><tr><th>Financial Year</th><td>${esc(c.fy)}</td><th>Return Period</th><td>${esc(c.period)}</td></tr><tr><th>GSTIN</th><td colspan="3">${esc(gstRead('gstTaxpayer',GST_DEMO).gstin)}</td></tr></table>
      <div class="gst-section-title">Declaration</div>
      <label style="display:flex;gap:8px;align-items:flex-start;font-size:14px"><input id="g1NilDeclare" type="checkbox"> <span>I hereby declare that there are no outward supplies, credit/debit notes, advances or amendments to report for this tax period, and this shall be filed as a Nil return.</span></label>
      <div class="gst-form-grid" style="margin-top:14px"><div><label>Name of Authorized Signatory *</label><input id="g1NilSigner" class="f-input" value="${esc(gstRead('gstTaxpayer',GST_DEMO).signatory||'Authorized Signatory')}"></div><div><label>Place *</label><input id="g1NilPlace" class="f-input" value="Kerala"></div></div>
      <div class="gst-action-row"><button class="gst-action" onclick="gstGstr1NilProceed()">PROCEED TO FILE</button></div><div id="g1NilMsg" class="demo-note"></div>`);
  };
  window.gstGstr1NilProceed=function(){
    const dec=document.getElementById('g1NilDeclare')?.checked,sign=document.getElementById('g1NilSigner')?.value.trim(),place=document.getElementById('g1NilPlace')?.value.trim(),m=document.getElementById('g1NilMsg');
    if(!dec||!sign||!place){m.innerHTML='<span style="color:#9a2f2f">Select the Nil-return declaration and complete Authorized Signatory and Place.</span>';return}
    const x=d();x.summary={generatedAt:new Date().toISOString(),supplyCount:0,taxableValue:0,totalTax:0,nil:true};x.status='Submitted';save(x);
    feature('GSTR-1 — Submit Application (Nil)','GSTR-1 > File Nil Return > Submit Application',`<div class="gst-pagebar"><div><b>Submit Application</b><div class="muted">Choose the electronic filing method for this Nil return</div></div><button class="gst-action secondary" onclick="gstGstr1NilFile()">BACK</button></div>
      <div class="gst-alert info"><b>Choose filing method</b><br>GST Portal filing uses either DSC or EVC, as applicable to the taxpayer.</div>
      <div class="gst-form-grid"><div><label>Authorized Signatory</label><input class="f-input" value="${esc(sign)}" readonly></div><div><label>Place</label><input class="f-input" value="${esc(place)}" readonly></div></div>
      <div class="gst-action-row"><button class="gst-action" onclick="gstGstr1FileEvc('${esc(sign)}')">FILE WITH EVC</button><button class="gst-action" onclick="gstGstr1FileDsc('${esc(sign)}')">FILE WITH DSC</button></div><div class="gst-alert warning">Training simulator: EVC/DSC authentication is simulated locally. No GSTN, bank, PAN or Aadhaar service is contacted.</div>`);
  };
  window.gstGstr1FilePage=function(){
    const x=d();if(x.status!=='Submitted'){notify('Submit the GSTR-1 before final filing.');return}
    const c=gstReturnContext();
    feature('GSTR-1 — File Return','Services > Returns > Returns Dashboard > GSTR-1 > File Return',`<div class="gst-pagebar"><div><b>GSTR-1 — File Return</b><div class="muted">Final filing of details of outward supplies</div></div><button class="gst-action secondary" onclick="gstOpenGstr1()">BACK</button></div>
      <div class="gst-alert info"><b>Final filing stage</b><br>Review the return summary before filing. Once filed, the return cannot be edited for this period.</div>
      <div class="gst-section-title">Return Details</div><table class="gst-table gst-portal-table"><tr><th>Financial Year</th><td>${esc(c.fy)}</td><th>Return Period</th><td>${esc(c.period)}</td></tr><tr><th>Reference</th><td>${esc(x.reference||'—')}</td><th>Status</th><td><span class="gst-status blue">Submitted</span></td></tr></table>
      <div class="gst-section-title">Declaration</div><label style="display:flex;gap:8px;align-items:flex-start;font-size:14px"><input id="g1FileDeclare" type="checkbox"> <span>I hereby declare that the information given in this return is true and correct and that the data has been reviewed by the authorized signatory.</span></label>
      <div class="gst-form-grid" style="margin-top:14px"><div><label>Name of Authorized Signatory *</label><input id="g1FileSigner" class="f-input" value="${esc(gstRead('gstTaxpayer',GST_DEMO).signatory||'Authorized Signatory')}"></div><div><label>Designation / Status *</label><input id="g1FileDesignation" class="f-input" value="Authorized Signatory"></div><div><label>Place *</label><input id="g1FilePlace" class="f-input" value="Kerala"></div></div>
      <div class="gst-action-row"><button class="gst-action" onclick="gstGstr1ProceedFile()">FILE GSTR-1</button><button class="gst-action secondary" onclick="gstGstr1Preview()">PREVIEW GSTR-1</button></div><div id="g1FileMsg" class="demo-note"></div>`);
  };

  window.gstGstr1ProceedFile=function(){
    const dec=document.getElementById('g1FileDeclare')?.checked,sign=document.getElementById('g1FileSigner')?.value.trim(),place=document.getElementById('g1FilePlace')?.value.trim(),m=document.getElementById('g1FileMsg');
    if(!dec||!sign||!place){m.innerHTML='<span style="color:#9a2f2f">Select the declaration and complete Authorized Signatory and Place.</span>';return}
    feature('GSTR-1 — Submit Application','GSTR-1 > File Return > Submit Application',`<div class="gst-pagebar"><div><b>Submit Application</b><div class="muted">Choose the electronic filing method</div></div><button class="gst-action secondary" onclick="gstGstr1FilePage()">BACK</button></div>
      <div class="gst-alert info"><b>Choose filing method</b><br>GST Portal filing uses either DSC or EVC, as applicable to the taxpayer.</div>
      <div class="gst-form-grid"><div><label>Authorized Signatory</label><input class="f-input" value="${esc(sign)}" readonly></div><div><label>Place</label><input class="f-input" value="${esc(place)}" readonly></div></div>
      <div class="gst-action-row"><button class="gst-action" onclick="gstGstr1FileEvc('${esc(sign)}')">FILE WITH EVC</button><button class="gst-action" onclick="gstGstr1FileDsc('${esc(sign)}')">FILE WITH DSC</button></div><div class="gst-alert warning">Training simulator: EVC/DSC authentication is simulated locally. No GSTN, bank, PAN or Aadhaar service is contacted.</div>`);
  };

  window.gstGstr1FileEvc=function(sign){feature('GSTR-1 — EVC Verification','GSTR-1 > File Return > File with EVC',`<div class="gst-pagebar"><div><b>File with EVC</b><div class="muted">OTP verification of the registered Authorized Signatory</div></div><button class="gst-action secondary" onclick="gstGstr1ProceedFile()">BACK</button></div><div class="gst-alert info">A simulated OTP has been sent to the registered email address and mobile number of the Authorized Signatory.</div><div class="gst-form-grid"><div><label>Authorized Signatory</label><input class="f-input" value="${esc(sign)}" readonly></div><div><label>OTP *</label><input id="g1FinalOtp" class="f-input" maxlength="6" inputmode="numeric" placeholder="Enter 6-digit OTP"></div></div><div class="gst-action-row"><button class="gst-action" onclick="gstGstr1CompleteFile('EVC','${esc(sign)}')">VALIDATE OTP & FILE GSTR-1</button></div><div class="demo-note">Training OTP: <b>123456</b></div>`)};
  window.gstGstr1FileDsc=function(sign){feature('GSTR-1 — DSC Verification','GSTR-1 > File Return > File with DSC',`<div class="gst-pagebar"><div><b>File with DSC</b><div class="muted">Digital signature certificate selection</div></div><button class="gst-action secondary" onclick="gstGstr1ProceedFile()">BACK</button></div><div class="gst-alert info">Select the registered DSC certificate and sign the return. The certificate interaction is simulated locally.</div><div class="gst-form-grid"><div><label>Authorized Signatory</label><input class="f-input" value="${esc(sign)}" readonly></div><div><label>DSC Certificate *</label><select id="g1DscCert" class="f-select"><option value="">Select Certificate</option><option>Training DSC — Authorized Signatory</option></select></div></div><div class="gst-action-row"><button class="gst-action" onclick="gstGstr1CompleteDsc('${esc(sign)}')">SELECT & SIGN</button></div>`)};
  window.gstGstr1CompleteDsc=function(sign){if(!document.getElementById('g1DscCert')?.value){notify('Select a DSC certificate.');return}gstGstr1CompleteFile('DSC',sign)};
  window.gstGstr1CompleteFile=function(mode,sign){
    const x=d();if(x.status!=='Submitted'){notify('GSTR-1 is not in Submitted status.');return}
    if(mode==='EVC' && document.getElementById('g1FinalOtp')?.value.trim()!=='123456'){notify('Enter the 6-digit training OTP 123456.');return}
    x.status='Filed';x.filedAt=new Date().toISOString();x.filingMode=mode;x.signatory=sign;x.arn='SIM-GSTR1-'+Date.now().toString().slice(-12);x.reference=x.arn;save(x);window.gstAddFiledReturn&&window.gstAddFiledReturn({reference:x.arn,filedAt:x.filedAt,status:'Filed',filingMode:mode,signatory:sign},'GSTR-1');gstGstr1FiledReceipt();
  };
  window.gstGstr1FiledReceipt=function(){
    const x=d(),c=gstReturnContext(),t=allTax(x);
    feature('GSTR-1 — Filed Successfully','Services > Returns > View e-Filed Returns',`<div class="gst-alert success"><b>GSTR-1 filed successfully.</b><br>Your return has been filed in the training simulator.</div><div class="gst-section-title">Filing Acknowledgement</div><table class="gst-table gst-portal-table"><tr><th>ARN / Reference</th><td>${esc(x.arn||x.reference||'—')}</td><th>Status</th><td><span class="gst-status green">Filed</span></td></tr><tr><th>Financial Year</th><td>${esc(c.fy)}</td><th>Return Period</th><td>${esc(c.period)}</td></tr><tr><th>Filing Mode</th><td>${esc(x.filingMode||'—')}</td><th>Filed On</th><td>${esc(x.filedAt?new Date(x.filedAt).toLocaleString('en-IN'):'—')}</td></tr><tr><th>Taxable Value</th><td>${gstMoney(t.taxable)}</td><th>Total Tax</th><td>${gstMoney(t.igst+t.cgst+t.sgst+t.cess)}</td></tr></table><div class="gst-alert info">A simulated acknowledgement represents the portal success response. Real GSTN ARN generation and filing require the live GST Portal.</div><div class="gst-action-row"><button class="gst-action secondary" onclick="gstGstr1Preview()">VIEW RETURN</button><button class="gst-action secondary" onclick="openReturnsDashboard()">BACK TO RETURNS DASHBOARD</button></div>`);
  };
})();

/* ===================================================================
   REALISTIC PAGE-LOADING DELAYS (2–4s on page opens, 4s fixed on login)
   Wraps the app's main page-rendering entry points so navigating to any
   Services page, GSTR-1/3B, e-Way Bill, e-Invoice, Registration, etc.
   shows a believable loading spinner first — matching a real government
   portal's pace rather than snapping instantly between screens.
   Deliberately NOT applied inside a single already-open form (e.g.
   clicking between the 10 Part-B registration tabs, or the "+ ADD" button
   that appends a promoter to a list) — delaying those would make filling
   in one form painfully slow rather than adding any realism, since
   nothing is actually "opening a new page" there.
   =================================================================== */
(function(){
  const _origFeature=window.feature;
  window.feature=function(title,sub,body){
    window.gstShowLoader('Loading...');
    setTimeout(()=>{ _origFeature(title,sub,body); window.gstHideLoader(); }, window.gstRandomDelay());
  };
  const _origRegistrationPage=window.registrationPage;
  if(typeof _origRegistrationPage==='function'){
    window.registrationPage=function(){
      window.gstShowLoader('Loading Registration...');
      setTimeout(()=>{ _origRegistrationPage(); window.gstHideLoader(); }, window.gstRandomDelay());
    };
  }
  const _origOpenTRNPartB=window.openTRNPartB;
  if(typeof _origOpenTRNPartB==='function'){
    window.openTRNPartB=function(){
      window.gstShowLoader('Loading Application...');
      setTimeout(()=>{ _origOpenTRNPartB(); window.gstHideLoader(); }, window.gstRandomDelay());
    };
  }
})();
