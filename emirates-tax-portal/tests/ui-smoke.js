/* UI smoke test (jsdom) - loads the real VAT pages against a seeded account and fails on any script error.
   Run from emirates-tax-portal/ :   npm i --no-save jsdom@24 && node tests/ui-smoke.js
   Seed: Q0 filed late (penalty), Q1 refund with Box 15 = No (credit), Q2 fully covered by the credit,
   Q3 partly covered, Q4 open draft. It prints the key figures each page shows. It does NOT click through the
   whole flow, it opens each page and checks that nothing throws and the carried-forward credit shows up. */
const {JSDOM,ResourceLoader,VirtualConsole}=require("jsdom");
const fs=require("fs"),path=require("path");
const ROOT=process.env.HUB_ROOT||path.resolve(__dirname,"..","..");
class FsLoader extends ResourceLoader{
  fetch(url){ const u=new URL(url); if(u.hostname!=="localhost") return Promise.resolve(Buffer.from(""));
    const p=path.join(ROOT,decodeURIComponent(u.pathname)); try{return Promise.resolve(fs.readFileSync(p));}catch(e){return Promise.reject(new Error("404 "+u.pathname));} } }
const store={}; const errors=[];
async function open(rel,{query="",wait=700}={}){
  const url="http://localhost/emirates-tax-portal/"+rel+(query?("?"+query):"");
  const vc=new VirtualConsole(); const errs=[];
  vc.on("jsdomError",e=>{ if(/getContext|Not implemented: navigation/.test(e.message)) { if(/navigation/.test(e.message)) errs.push("REDIRECT (session/guard)"); return; } errs.push("jsdomError: "+(e.detail&&e.detail.message||e.message)); });
  vc.on("error",(...a)=>errs.push("console.error: "+a.join(" ")));
  const html=fs.readFileSync(path.join(ROOT,"emirates-tax-portal",rel),"utf8");
  const dom=new JSDOM(html,{url,runScripts:"dangerously",resources:new FsLoader(),pretendToBeVisual:true,virtualConsole:vc,
    beforeParse(w){ Object.keys(store).forEach(k=>w.localStorage.setItem(k,store[k]));
      w.matchMedia=w.matchMedia||(()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}));
      w.alert=()=>{}; w.confirm=()=>true; w.scrollTo=()=>{}; w.HTMLElement.prototype.scrollIntoView=function(){};
      w.addEventListener("error",e=>errs.push("window.error: "+e.message)); } });
  await new Promise(r=>dom.window.addEventListener("load",()=>setTimeout(r,wait)));
  const w=dom.window; for(let i=0;i<w.localStorage.length;i++){const k=w.localStorage.key(i);store[k]=w.localStorage.getItem(k);}
  return {w,errs,dom,url:w.location.href};
}
module.exports={open,store};
if(require.main===module){(async()=>{
  // ---- seed: account, session, filings
  const boot=await open("pages/other-services.html",{wait:200}); // loads storage.js; session missing -> redirects, fine
  const w=boot.w; const V=w.eval("VATSIM");
  const acc={companyName:"Smoke Trading LLC",companyNameAr:"س",tradeName:"Smoke",tradeLicenseNo:"L1",applicantType:"x",businessActivity:"x",registrationType:"x",turnover:"x",firstNameEn:"Asha",lastNameEn:"K",firstNameAr:"",lastNameAr:"",emiratesId:"784-1990-1234567-1",designation:"Owner",emirate:"Dubai",address:"x",phone:"1",email:"smoke@test.ae",password:"x",bankName:"x",bankAccountHolder:"x",iban:"AE070331234567890123456",trn:"100123456700003",arn:"1",registrationDate:"2026-01-01",registrationStatus:"Registered",staggerType:"2",createdAt:new Date().toISOString()};
  V.saveAccount(acc); V.setSession({email:acc.email,loggedInAt:new Date().toISOString()});
  const mk=(from,to,due,fn)=>{const f=V.newFilingSkeleton(acc,{label:from,from,to,dueDate:due,taxYear:"2026",taxYearEnd:"2026-12-31",stagger:"Stagger 2 – Quarterly (Jan to Dec)"});f.boxes.b2={amount:0,vat:0};f.boxes.b6={amount:0,vat:0};fn(f);return f;};
  const q1=mk("2026-01-01","2026-03-31","2026-04-28",f=>{f.boxes.b1.dubai.amount=10000;f.boxes.b1.dubai.vat=500;f.boxes.b9.amount=40000;f.boxes.b9.vat=2000;f.boxes.requestRefund="No";f.status="Submitted";f.submittedAt=new Date(2026,3,20,10).toISOString();f.referenceNumber="VAT111111111";});
  const q2=mk("2026-04-01","2026-06-30","2026-07-28",f=>{f.boxes.b1.dubai.amount=20000;f.boxes.b1.dubai.vat=1000;f.status="Submitted";f.submittedAt=new Date(2026,6,20,10).toISOString();f.referenceNumber="VAT222222222";});
  const q3=mk("2026-07-01","2026-09-30","2026-10-28",f=>{f.boxes.b1.dubai.amount=40000;f.boxes.b1.dubai.vat=2000;f.status="Submitted";f.submittedAt=new Date(2026,9,28,9).toISOString();f.referenceNumber="VAT333333333";});
  const q0=mk("2025-10-01","2025-12-31","2026-01-28",f=>{f.boxes.b1.dubai.amount=20000;f.boxes.b1.dubai.vat=1000;f.status="Submitted";f.submittedAt=new Date(2026,1,5,10).toISOString();f.referenceNumber="VAT000000000";});
  const q4=mk("2026-10-01","2026-12-31","2027-01-28",f=>{f.boxes.b1.dubai.amount=1000;f.boxes.b1.dubai.vat=50;f.boxes.b3.amount=1000;f.boxes.b3.vat=50;f.boxes.b10.amount=1000;f.boxes.b10.vat=50;f.boxes.profitMargin="No";});
  V.saveFilings? V.saveFilings([q0,q1,q2,q3,q4]) : null;
  for(let i=0;i<w.localStorage.length;i++){const k=w.localStorage.key(i);store[k]=w.localStorage.getItem(k);}
  console.log("seeded filings:",V.getFilings().length, "ids", [q1,q2,q3,q4].map(f=>f.id).join(","));
  fs.writeFileSync("/tmp/jsd/ids.json",JSON.stringify([q1,q2,q3,q4,q0].map(f=>f.id)));
  const [i1,i2,i3,i4,i0]=JSON.parse(fs.readFileSync("/tmp/jsd/ids.json"));
  const tests=[
    ["pages/dashboard.html",""],["pages/filings.html",""],["pages/liabilities.html",""],["pages/settings.html",""],
    ["pages/return.html","id="+i4],["pages/review.html","id="+i4,3500],
    ["pages/success.html","id="+i1],["pages/success.html","id="+i2],["pages/success.html","id="+i3],["pages/success.html","id="+i0],
    ["pages/payment.html","id="+i2],["pages/payment.html","id="+i3],
    ["pages/voluntary-disclosure.html","id="+i3],["pages/other-services.html",""],["pages/excise.html",""],["pages/correspondence.html",""],
  ];
  let bad=0;
  for(const [p,q,wt] of tests){ const r=await open(p,{query:q,wait:wt||900}); const d=r.w.document;
    const t=(id)=>{const e=d.getElementById(id);return e?e.textContent.trim().replace(/\s+/g," "):null;};
    console.log((r.errs.length?"ERR ":"OK  ")+p+(q?"?id=…"+q.slice(-4):""),"→",r.w.location.pathname.split("/").pop(), r.errs.length?JSON.stringify(r.errs.slice(0,3)):"");
    if(r.errs.length) bad++;
    if(p.endsWith("success.html")) console.log("     penaltyPanel:",(d.getElementById("penaltyPanel")||{style:{}}).style.display||"hidden","|",(t("penaltyGrid")||"").slice(0,150));
    if(p.endsWith("success.html")) console.log("     sDueAmt:",t("sDueAmt"),"| stagger:",t("sStagger"),"| cta:",(t("paymentCta")||"").slice(0,170));
    if(p.endsWith("liabilities.html")) console.log("     rows:",[...d.querySelectorAll("tbody tr")].map(tr=>tr.textContent.trim().replace(/\s+/g," ").slice(0,140)).join(" || "));
    if(p.endsWith("dashboard.html")) console.log("     outstanding:",t("outstandingLiability"));
    if(p.endsWith("review.html")) console.log("     stagger:",t("fStagger"),"| net due section:",[...d.querySelectorAll(".review-item")].map(e=>e.textContent.trim().replace(/\s+/g," ")).filter(x=>/Box 14|Box 15|Credit|Net amount/.test(x)).join(" | "));
    if(p.endsWith("settings.html")) console.log("     stagger options:",[...d.querySelectorAll('#staggerGroup label')].map(e=>e.textContent.trim()).join(" | "));
  }
  console.log(bad?("PAGES WITH ERRORS: "+bad):"ALL PAGES LOADED WITHOUT SCRIPT ERRORS");
  process.exit(0);
})().catch(e=>{console.error("HARNESS FAIL",e);process.exit(1);});}
