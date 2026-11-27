const {boot}=require('./ui_job.js');
const SEA_POL='Nhava Sheva (JNPT), Mumbai';
function base(mode){ const air=/^Air/.test(mode), road=/^Road|^Ware/.test(mode);
 return {mode, origin:'Cochin, India', destination:'UAE', sellerName:'Meridian Exports Pvt. Ltd.', sellerAddress:'Plot 14, MIDC Industrial Area, Pune', sellerCountry:'India', sellerGSTIN:'27AABCT4521K1ZM', sellerIEC:'AABCT4521K', sellerPAN:'AABCT4521K', sellerPhone:'+91 98200 12345', sellerEmail:'exports@meridian.co.in', authorizedSignatory:'Priya Sharma',
  buyerName:'Nordic Trading GmbH', buyerAddress:'Hafenstrasse 22, Hamburg', buyerGSTIN:'', buyerIEC:'AABCT4521K', buyerPhone:'+49 40 123456', buyerEmail:'procurement@nordictrading.de',
  poNumber:'88213', quantity:'500', grossWeight:'2100', invoiceValue:'42500', currency:'USD', paymentTerms:'Letter of Credit', expectedShipmentDate:'2026-12-01', incoterm:'FOB',
  portOfLoading: air?'Mumbai (BOM) Airport':SEA_POL, portOfDischargeCountry:'UAE', portOfDischarge: air?'Dubai (DXB) Airport':'Jebel Ali Port, Dubai', containerNo:'MSKU1234567', containerCompany:'Maersk Line',
  vesselName: air?'Emirates SkyCargo':'MSC Aria', voyageNo: air?'EK544':'V221E', flightDate:'2026-12-01', aircraftType:'Boeing 777F', aircraftRegistration:'A6-EFA', carrierName: air?'Emirates SkyCargo':'Mediterranean Shipping Company (MSC)',
  vehicleNumber:'KL07AB1234', sealNo:'SL-994231', deliveryChallanNo:'MPM/DC/2026/00734', ewayBillNo:'351122334455', lorryReceiptNo:'SRC/LR/2026/018842', driverName:'Joseph Thomas', freightAmount:'42000', loadingCharge:'2500', unloadingCharge:'2500', warehouseName:'Malabar Distribution RDC', warehouseCode:'BLR-RDC-01', warehouseManagerName:'Suresh Gowda'}; }
function item(){ return {product:'Cotton T-Shirts',description:'100% combed cotton, crew neck',productCode:'BP-COTTON-01',hsCode:'61091000',quantity:'5000',unit:'PCS',unitPrice:'8.50',discount:'0',weight:'2100',countryOfManufacture:'India',brandModel:'MER-CT-2026',netWeight:'1980',packageType:'Cartons',manufacturerDetails:'Meridian Exports Pvt. Ltd., Pune',batchNo:'',mfgDate:'',expDate:'',isDangerousGoods:'No'}; }
function setVal(w,el,v){ el.value=v; el.dispatchEvent(new w.Event('input',{bubbles:true})); el.dispatchEvent(new w.Event('change',{bubbles:true})); }
async function run(name,mode,fOver,iOver){
  const dom=await boot(); const w=dom.window; const toasts=[]; w.showToast=(m)=>toasts.push(m);
  w.eval('openJobModal(null)'); await new Promise(r=>setTimeout(r,300));
  const f=Object.assign(base(mode),fOver||{});
  const modeEl=w.document.querySelector('#jobFormGrid [data-jobfield="mode"]'); setVal(w,modeEl,mode);
  await new Promise(r=>setTimeout(r,100));
  // set country first so port lists populate, then everything else
  ['destination','portOfDischargeCountry'].forEach(k=>{const el=w.document.querySelector(`#jobFormGrid [data-jobfield="${k}"]`); if(el) setVal(w,el,f[k]);});
  Object.keys(f).forEach(k=>{ if(k==='mode')return; const el=w.document.querySelector(`#jobFormGrid [data-jobfield="${k}"]`); if(el) setVal(w,el,f[k]); });
  const it=Object.assign(item(),iOver||{});
  const row=w.document.querySelector('#jobItemsList .job-item-row');
  Object.keys(it).forEach(k=>{ const el=row.querySelector(`[data-itemfield="${k}"]`); if(el){ if(el.tagName==='SELECT'){ el.value=it[k]; el.dispatchEvent(new w.Event('change',{bubbles:true})); } else setVal(w,el,it[k]); }});
  const cb=w.document.querySelector('.jobdoc-check'); if(cb) cb.checked=true;
  w.document.getElementById('jobSaveBtn').click(); await new Promise(r=>setTimeout(r,300));
  const keys=Object.keys(w.localStorage).filter(k=>k.startsWith('skelora_job_v1_u_test1'));
  let saved=null; if(keys.length) saved=JSON.parse(w.localStorage.getItem(keys[0]));
  const redEls=[...w.document.querySelectorAll('#jobFormGrid [data-jobfield], #jobItemsList [data-itemfield]')].filter(e=>e.style.borderColor==='var(--red)').map(e=>e.getAttribute('data-jobfield')||('item.'+e.getAttribute('data-itemfield')));
  console.log(`\n[${name}] ${mode}\n  saved: ${!!saved}  red: ${redEls.join(',')||'-'}\n  toast: ${toasts.join(' | ')||'-'}`);
  if(saved){ const sf=(saved.fields||saved); console.log('  stored vehicle/seal/voyage/UN:',sf.vehicleNumber,sf.sealNo,sf.voyageNo,(sf.items&&sf.items[0]&&sf.items[0].unNumber)); }
  dom.window.close(); return {saved,toasts,redEls};
}
module.exports={run,base,item};
if(require.main===module)(async()=>{
 await run('A old placeholders gross/invoice','Sea Export',{grossWeight:'8500',invoiceValue:'40000'});
 await run('B valid sea export','Sea Export');
 await run('C road, hyphenated vehicle','Road / Domestic',{vehicleNumber:'kl-07-ab-1234'});
 await run('D air, sea-style voyage','Air Export',{voyageNo:'V221E'});
 await run('D2 air, valid flight','Air Export');
 await run('E short HS code','Sea Export',{},{hsCode:'6109'});
 await run('F DG, old UN placeholder','Sea Export',{},{isDangerousGoods:'Yes',unNumber:'1090',hazardClass:'3',packingGroup:'II',flashpoint:'-20C',tankType:'T14',emsCode:'F-E, S-D'});
 await run('F2 DG, lowercase un1090','Sea Export',{},{isDangerousGoods:'Yes',unNumber:'un1090',hazardClass:'3',packingGroup:'II',flashpoint:'-20C',tankType:'T14',emsCode:'F-E, S-D'});
 await run('G net > gross','Sea Export',{},{netWeight:'2500'});
 process.exit(0);
})();
