const {JSDOM,VirtualConsole}=require('jsdom');
const URL='http://localhost:8765/logistics-simulator/skelora-institute-dashboard.html';
const USER={id:'u_test1',name:'Test Student',email:'SKELORA2026001',passHash:'x',savedPassword:'1234',role:'student',position:'',createdAt:new Date().toISOString()};
async function boot(){
  const vc=new VirtualConsole(); const errs=[]; vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
  const dom=await JSDOM.fromURL(URL,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc,
    beforeParse(w){ w.localStorage.setItem('skelora_users_v1',JSON.stringify([USER])); w.localStorage.setItem('skelora_session_v1',USER.id);
      w.matchMedia=w.matchMedia||(()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}})); w.scrollTo=()=>{}; w.HTMLElement.prototype.scrollIntoView=function(){}; w.confirm=()=>true; w.alert=()=>{}; }});
  await new Promise(r=>setTimeout(r,2500)); dom.errs=errs; return dom;
}
module.exports={boot,USER};
if(require.main===module){(async()=>{ const dom=await boot(); const w=dom.window; console.log('CURRENT_USER',w.eval('CURRENT_USER&&CURRENT_USER.id'),'errors',dom.errs.slice(0,5));
 w.eval('openJobModal(null)'); await new Promise(r=>setTimeout(r,500));
 const keys=[...w.document.querySelectorAll('#jobFormGrid [data-jobfield]')].map(e=>e.getAttribute('data-jobfield')); console.log('job fields rendered:',keys.length,keys.join(','));
 console.log('item fields:',[...w.document.querySelectorAll('#jobItemsList .job-item-row [data-itemfield]')].map(e=>e.getAttribute('data-itemfield')+':'+e.tagName).join(','));
 console.log('doc checks:',w.document.querySelectorAll('.jobdoc-check').length);
 process.exit(0);})();}
