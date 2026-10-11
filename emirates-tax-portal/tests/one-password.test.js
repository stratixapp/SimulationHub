const {JSDOM}=require('jsdom');
const fs=require('fs');const root=require('path').join(__dirname,'..')+'/';
const dom=new JSDOM('<!doctype html><body></body>',{url:'http://localhost/index.html',runScripts:'outside-only'});
const w=dom.window;
w.localStorage.setItem('vatsim_global_active', JSON.stringify('p1'));
w.localStorage.setItem('uae_tax_portal_students_v1', JSON.stringify([{id:'p1',name:'Anju',pin:'1234'}]));
w.eval(fs.readFileSync(root+'shared/identity.js','utf8'));
w.eval(fs.readFileSync(root+'js/storage.js','utf8')+';window.VATSIM=VATSIM;');
const V=w.VATSIM; let pass=0,fail=0;
const t=(n,c)=>{ if(c){pass++;console.log('PASS',n)}else{fail++;console.log('FAIL',n)} };
t('strong ok', V.isStrongPassword('Anju@2026'));
t('weak 1234', !V.isStrongPassword('1234'));
t('weak no symbol', !V.isStrongPassword('Anju2026x'));
// portal student: id p1, registry has name+pin
const id=V.getActiveStudentId(); t('active id p1', id==='p1');
V.saveUaePass({firstName:'A',lastName:'B',pin:'4321',password:'Old@pass1'});
const ns='vatsim_v1_p1_';
// legacy: all accepted
t('legacy pin accepted', V.passwordMatchesStudent('p1','4321'));
t('legacy portal pin accepted', V.passwordMatchesStudent('p1','1234'));
t('wrong rejected', !V.passwordMatchesStudent('p1','nope'));
t('master = strong legacy', V.getMasterPassword('p1')==='Old@pass1');
// sync new single password
w.localStorage.setItem(Object.keys(w.localStorage).find(k=>k.endsWith('uaepass')).replace('uaepass','account'), JSON.stringify({email:'a@b.com',password:'x12345'}));
V.syncMasterPassword('One@Pass99','p1');
const up=V.getUaePass();
t('uaepass pin+password synced', up.pin==='One@Pass99' && up.password==='One@Pass99');
t('registry pin synced', JSON.parse(w.localStorage.getItem('uae_tax_portal_students_v1'))[0].pin==='One@Pass99');
const accKey=Object.keys(w.localStorage).find(k=>k.endsWith('account'));
t('account password synced', JSON.parse(w.localStorage.getItem(accKey)).password==='One@Pass99');
t('one password works everywhere', V.passwordMatchesStudent('p1','One@Pass99'));
t('old pin no longer works after sync', !V.passwordMatchesStudent('p1','4321'));
console.log(pass+' passed, '+fail+' failed'); process.exit(fail?1:0);
