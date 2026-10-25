/* Night-ship boot loader — scene by Ananthu Shaji (night-ship-loading-whale.html), integrated into the Logistics Simulator.
 * Changes vs the standalone file: wrapped in an IIFE (no globals leak into auth.js etc.); the endless demo loop is replaced by a
 * paced run of CFG.seconds that calls CFG.onComplete() when the ship has berthed; CFG.ready() can hold it at 99% until the next
 * screen is fetched; errors / WebGL context loss / a too-slow device call CFG.onError() or finish early so the app is never blocked.
 * Config comes from window.SHIP_LOADER_CONFIG (set by index.html). Three.js r128 + fonts are loaded from ./vendor and ./fonts (offline-safe). */
(function(){
var CFG=window.SHIP_LOADER_CONFIG||{};
var DURATION=CFG.seconds>0?CFG.seconds:12,HOLD=CFG.holdSeconds>=0?CFG.holdSeconds:2.2,K=25.45/DURATION,finishing=false,slowEma=.016,dead=false;
function fail(e){if(dead)return;dead=true;try{console.error("[ship-loader]",e)}catch(_){}if(CFG.onError)CFG.onError(e)}
function leave(hold){setTimeout(function(){var fd=document.getElementById("fd");if(fd)fd.style.opacity=1;setTimeout(function(){if(CFG.onComplete)CFG.onComplete()},500)},hold*1000)}
/* ---- edit these ---- */
var TEXT={sunset:["Please wait...","Processing your request"],night:["Loading...","Preparing your documents"]};
var START="night";var STAGES=["Preparing your documents","Loading your workspace","Almost there","All set"];

var T=THREE,cv=document.getElementById("c"),R=new T.WebGLRenderer({canvas:cv,antialias:true});
R.setPixelRatio(Math.min(devicePixelRatio,2));R.shadowMap.enabled=true;R.shadowMap.type=T.PCFSoftShadowMap;
var scene=new T.Scene(),cam=new T.PerspectiveCamera(45,1,.5,3000),PX={value:800};scene.fog=new T.FogExp2(0x0f1f40,.0025);

/* ---- shared uniforms + GLSL ---- */
var V3=function(){return {value:new T.Vector3()}};
var U={uTime:{value:0},uTop:V3(),uMid:V3(),uHor:V3(),uSunCol:V3(),uSun:{value:new T.Vector3(0,.2419,-.9703).normalize()},uSunI:{value:1},
  uDeep:V3(),uSub:V3(),uCD:V3(),uCL:V3(),uCl:{value:.8},uShip:{value:new T.Vector2()},uYaw:{value:0},uSpd:{value:1},uSk:{value:0}};
var SKY="uniform vec3 uTop,uMid,uHor,uSunCol,uSun;uniform float uSunI,uTime;"+
"vec3 skyCol(vec3 d){float h=max(d.y,0.);vec3 c=mix(uHor,uMid,smoothstep(0.,.2,h));c=mix(c,uTop,smoothstep(.12,.75,h));float s=max(dot(d,uSun),0.);"+
"c+=uSunCol*uSunI*(pow(s,6.)*.3+pow(s,48.)*.7+smoothstep(.9992,.9997,s)*6.);c+=vec3(.7,.82,1.)*(1.-uSunI)*(smoothstep(.9972,.9976,s)*1.25+pow(s,24.)*.2);return c;}";
var NOISE="float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}"+
"float nz(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1.,0.)),f.x),mix(hs(i+vec2(0.,1.)),hs(i+vec2(1.,1.)),f.x),f.y);}"+
"float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*nz(p);p*=2.03;a*=.5;}return s;}";

/* sky dome */
var sky=new T.Mesh(new T.SphereGeometry(800,32,16),new T.ShaderMaterial({uniforms:U,side:T.BackSide,depthWrite:false,
 vertexShader:"varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*viewMatrix*vec4(position+cameraPosition,1.);}",
 fragmentShader:SKY+NOISE+"uniform vec3 uCD,uCL;uniform float uCl;varying vec3 vD;void main(){vec3 d=normalize(vD);vec3 c=skyCol(d);float s0=max(dot(d,uSun),0.),md=smoothstep(.9972,.9976,s0)*(1.-uSunI);if(md>0.){vec3 ax=normalize(cross(uSun,vec3(0.,1.,0.))),ay=cross(ax,uSun);vec2 mp=vec2(dot(d,ax),dot(d,ay))*22.;float mr=fbm(mp*3.)*.6+fbm(mp*9.+7.)*.25;c=mix(c,c*(.6+.55*mr),md);}"+
 "if(d.y>0.){c+=vec3(.9,.95,1.)*step(.9975,hs(floor(d.xz/(d.y+.25)*180.)))*(.55+.45*sin(uTime*3.+hs(floor(d.xz/(d.y+.25)*180.))*600.))*smoothstep(.04,.3,d.y)*(1.-uSunI)*.9;c+=vec3(.45,.55,1.)*exp(-pow(dot(d,normalize(vec3(.35,.45,.82))),2.)*55.)*fbm(d.xz/(d.y+.3)*4.)*.16*(1.-uSunI)*smoothstep(.12,.45,d.y);vec2 uv=d.xz/(d.y+.1)*.9+vec2(uTime*.01,0.);float n=fbm(uv*1.4);float cl=smoothstep(.48,.8,n)*smoothstep(0.,.1,d.y)*uCl;"+
 "float s=max(dot(d,uSun),0.);vec3 cc=mix(uCD,uCL,clamp(pow(s,2.)*1.5+(1.-d.y)*.5,0.,1.));cc*=.8+.5*fbm(uv*4.);cl*=1.-.9*smoothstep(.975,.998,s);c=mix(c,cc,cl);}gl_FragColor=vec4(c,1.);}"}));
sky.frustumCulled=false;sky.renderOrder=-1;scene.add(sky);

/* ocean (Gerstner-style sines; JS copy below drives the ship) */
var WS=[[.25,1,1.3,.11,.95],[-.5,.8,.7,.19,1.25],[.9,1,.38,.37,1.7],[1,.3,.2,.71,2.3],[-.8,.6,.14,.93,2.9],[.4,-1,.09,1.35,3.4]].map(function(w){var l=Math.hypot(w[0],w[1]);return[w[0]/l,w[1]/l,w[2],w[3],w[4]]});
function H(x,z,t){var h=0;WS.forEach(function(w){h+=w[2]*Math.sin((w[0]*x+w[1]*z)*w[3]+t*w[4])});return h}
var wcode=WS.map(function(w){return"wv(pos.xz,vec2("+w[0].toFixed(4)+","+w[1].toFixed(4)+"),"+w[2]+","+w[3]+","+w[4]+",h,g);"}).join("");
var sea=new T.Mesh(new T.PlaneGeometry(700,700,360,360).rotateX(-Math.PI/2),new T.ShaderMaterial({uniforms:U,
 vertexShader:"uniform float uTime;varying vec3 vP;varying float vH;varying vec2 vG;"+
 "void wv(vec2 p,vec2 d,float a,float f,float s,inout float h,inout vec2 g){float ph=dot(d,p)*f+uTime*s;h+=a*sin(ph);g+=a*f*cos(ph)*d;}"+
 "void main(){vec3 pos=(modelMatrix*vec4(position,1.)).xyz;float h=0.;vec2 g=vec2(0.);"+wcode+"pos.y=h;vP=pos;vH=h;vG=g;gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.);}",
 fragmentShader:SKY+NOISE+"uniform vec3 uDeep,uSub;uniform vec2 uShip;uniform float uYaw,uSpd,uSk;varying vec3 vP;varying float vH;varying vec2 vG;float wb(float x){float u=clamp((x-6.)/13.5,0.,1.);return x>=6.?6.3*pow(max(1.-u*u,0.),.9):4.2+2.1*smoothstep(-20.,-6.,x);}void main(){"+
 "vec3 V=normalize(cameraPosition-vP);vec2 q=vP.xz;vec2 g=vG+.05*vec2(sin(q.x*2.1+uTime*1.7)+sin(q.y*3.3-uTime*1.3),cos(q.x*1.6-uTime*1.1)+cos(q.y*2.5+uTime*1.5));"+
 "float dd=length(cameraPosition-vP);g+=exp(-dd*.004)*(.18*vec2(nz(q*1.7+uTime*.45)-.5,nz(q*1.7+17.-uTime*.4)-.5)+.1*vec2(nz(q*5.+uTime*.9)-.5,nz(q*5.+9.-uTime*.8)-.5));vec3 N=normalize(vec3(-g.x,1.,-g.y));vec3 Rf=reflect(-V,N);Rf.y=abs(Rf.y);float fr=.03+.97*pow(1.-max(dot(N,V),0.),5.);"+
 "vec3 body=uDeep+uSub*(.5+.5*clamp(vH/2.,-1.,1.))*.7;vec3 col=mix(body,skyCol(Rf),fr);col+=uSub*pow(clamp(vH/2.+.5,0.,1.),3.)*.9*(1.-fr);vec3 Hh=normalize(V+uSun);float spc=pow(max(dot(N,Hh),0.),220.);col+=mix(vec3(1.,.75,.45),vec3(.7,.82,1.),1.-uSunI)*spc*2.2*exp(-dd*.003);"+
 "float fo=smoothstep(1.6,2.5,vH+.55*(fbm(q*.45+uTime*.25)-.5));col=mix(col,(uHor*.4+.6)*vec3(.95,.97,1.),fo*.75);"+
 "vec2 e=vP.xz-uShip;vec2 qw=vec2(e.y,-e.x)/vec2(3.85,2.2),qh=vec2(dot(e,vec2(sin(uYaw),cos(uYaw))),dot(e,vec2(-cos(uYaw),sin(uYaw))))/vec2(3.85,2.2);float hw=wb(qh.x)+.3;float sw=uSk,ld=smoothstep(0.,.6,sw*sign(qh.y));float fl=(1.-smoothstep(0.,2.6+7.*ld*abs(sw),abs(qh.y)-hw))*step(-21.,qh.x)*step(qh.x,24.)*(.5+.8*nz(vec2(qh.x*.5+uTime*2.5,qh.y*1.2)))*(.5+.5*uSpd+ld*abs(sw));float bx=-(20.*abs(cos(uYaw))+3.7*abs(sin(uYaw)))-qw.x,wk=0.;"+
"if(bx>0.){float wd=6.5+bx*.14+28.*abs(sin(uYaw));wk=(1.-smoothstep(0.,130.,bx))*((1.-smoothstep(0.,wd,abs(qw.y)))*.8+(1.-smoothstep(0.,1.8,abs(abs(qw.y)-wd)))*1.2)*(.4+.9*nz(vec2((qw.x+uTime*3.)*.35,qw.y*.9)))*uSpd;}"+
"col=mix(col,vec3(.92,.96,1.)*(uHor*.35+.65),clamp(fl+wk,0.,1.)*.8);"+
"float d=length(cameraPosition-vP);col=mix(col,uHor,1.-exp(-d*.0055));gl_FragColor=vec4(col,1.);}"}));
sea.frustumCulled=false;scene.add(sea);

/* ---- ship ---- */
var rig=new T.Group(),ship=new T.Group();ship.scale.set(3.85,2.2,2.2);rig.add(ship);rig.rotation.y=-Math.PI/2;rig.position.z=-330;scene.add(rig);
function mat(c,r,m){return new T.MeshStandardMaterial({color:c,roughness:r==null?.6:r,metalness:m==null?.2:m})}
function xtr(shape,depth,mt,y,sx,sy){var m=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:depth,bevelEnabled:false,curveSegments:14}),mt);m.rotation.x=-Math.PI/2;m.position.y=y;m.scale.set(sx,sy,1);ship.add(m);return m}
var YW=-.5,YD=5.03,YS=.15;
function sm(a,b,x){x=Math.min(1,Math.max(0,(x-a)/(b-a)));return x*x*(3-2*x)}
function Bd(x){if(x<=9)return 6.5-.95*(1-sm(-20,-12,x));var u=Math.min(1,(x-9)/14);return 6.5*Math.pow(1-u*u,.9)}
function Wb(x){if(x>=6){var u=Math.min(1,(x-6)/13.5);return 6.3*Math.pow(1-u*u,.9)}return 4.2+2.1*sm(-20,-6,x)}
function Y0(x){if(x>=19.5)return YW+Math.pow(Math.min(1,(x-19.5)/3.5),.74)*(YD-YW);if(x>=6)return -3.2+2.7*Math.pow((x-6)/13.5,2.2);if(x>=-6)return -3.2;return -3.2+2.2*Math.pow(Math.min(1,(-6-x)/14),1.8)}
function prof(x){var y0=Y0(x),ya=Math.max(YW,y0),hb=ya-y0,w=Wb(x),bd=Bd(x),hS=(Math.max(YS,ya)-ya)/Math.max(YD-ya,.001),lo=[],up=[],i;
 function f(h){return[ya+h*(YD-ya),w+(bd-w)*Math.pow(h,1.5)]}
 for(i=0;i<10;i++){var a=i/10*Math.PI/2;lo.push([ya-hb*Math.pow(Math.cos(a),.667),w*Math.pow(Math.sin(a),.667)])}
 lo.push(f(0),f(hS/2),f(hS));for(i=0;i<=6;i++)up.push(f(hS+(1-hS)*i/6));return[lo,up]}
function rng2(p,top){var r=[],k;for(k=p.length-1;k>=(top?0:1);k--)r.push([p[k][0],-p[k][1]]);if(!top)r.push([p[0][0],0]);for(k=top?0:1;k<p.length;k++)r.push(p[k]);return r}
var STN=[],xs0;for(xs0=-20;xs0<18;xs0+=.75)STN.push(xs0);for(xs0=18;xs0<=23.05;xs0+=.12)STN.push(xs0);
function geo(pos,ix){var g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.setIndex(ix);g.computeVertexNormals();return g}
function loft(top,mt){var pos=[],ix=[],n=0,i,j,r;STN.forEach(function(x){r=rng2(prof(x)[top?1:0],top);n=r.length;r.forEach(function(q){pos.push(x,q[0],q[1])})});
 for(i=0;i<STN.length-1;i++)for(j=0;j<n-1;j++){var a=i*n+j,b=a+n;ix.push(a,b,a+1,a+1,b,b+1)}
 ship.add(new T.Mesh(geo(pos,ix),mt));
 var cp=[],ci=[],cy=0;r=rng2(prof(-20)[top?1:0],top);r.forEach(function(q){cy+=q[0]/r.length;cp.push(-20,q[0],q[1])});cp.push(-20,cy,0);for(i=0;i<r.length-1;i++)ci.push(i,i+1,r.length);ship.add(new T.Mesh(geo(cp,ci),mt))}
var mR=mat(0xc23a1c,.7,.1),mG=mat(0x0c6b45,.4,.35);mR.side=mG.side=T.DoubleSide;loft(0,mR);loft(1,mG);
var bulb=new T.Mesh(new T.SphereGeometry(1,18,12),mR);bulb.scale.set(2.9,1.35,1.5);bulb.position.set(19.2,-1.9,0);ship.add(bulb);
var ds=new T.Shape();STN.forEach(function(x,i){i?ds.lineTo(x,-Bd(x)):ds.moveTo(x,-Bd(x))});for(var di=STN.length-1;di>=0;di--)ds.lineTo(STN[di],Bd(STN[di]));
var deck=new T.Mesh(new T.ShapeGeometry(ds),mat(0x2b3140,.9,0));deck.rotation.x=-Math.PI/2;deck.position.y=5.03;ship.add(deck);

/* containers: fictional shipping lines, each with its own painted texture (edit LINES to change names) */
var LINES=[["NORDLINE","#1f4f8f","#ffffff"],["PACIFIC STAR","#c0392b","#ffffff"],["ORIENTEX","#d9822b","#101820"],["SEAWAYS","#2e7d5b","#ffffff"],["AURORA LINES","#6a3d9a","#ffffff"],["BLUEHORN","#0e7490","#ffffff"],["TRANSOCEAN","#8b1e2d","#f3e9d2"],["GLOBELINK","#b8a22a","#101820"]],bins=LINES.map(function(){return[]}),sd=11;
function rnd(){sd=(sd*9301+49297)%233280;return sd/233280}
function ctex(l,w){var c=document.createElement("canvas");c.width=w;c.height=128;var x=c.getContext("2d");x.fillStyle=l[1];x.fillRect(0,0,w,128);x.fillStyle="rgba(0,0,0,.22)";for(var i=0;i<w;i+=w/32)x.fillRect(i,10,w/85,108);x.fillStyle="rgba(0,0,0,.4)";x.fillRect(0,0,w,10);x.fillRect(0,118,w,10);
 x.fillStyle=l[2];x.textAlign="center";x.textBaseline="middle";var f=30*w/256;do{x.font="800 "+f+"px Montserrat,Arial,sans-serif";f-=1}while(x.measureText(l[0]).width>w*.88&&f>7);x.fillText(l[0],w/2,52);
 x.font="600 "+Math.max(9,15*w/256)+"px Montserrat,Arial,sans-serif";x.fillText(l[3],w/2,92);var t=new T.CanvasTexture(c);t.anisotropy=4;return t}
var cg=new T.BoxGeometry(3.37,2.5,2.35);
[-8.4,-4.9,-1.4,2.1,5.6,9.1,12.6].forEach(function(x,si){(si==6?[-2.45,0,2.45]:[-4.9,-2.45,0,2.45,4.9]).forEach(function(z){var k=1+Math.floor(rnd()*(si==6?2:5));for(var j=0;j<k;j++){bins[Math.floor(rnd()*LINES.length)].push(new T.Matrix4().setPosition(x,6.3+j*2.5,z))}})});
LINES.forEach(function(l,i){var a=bins[i];if(!a.length)return;l.push(l[0].replace(/[^A-Z]/g,"").slice(0,3)+"U "+(100000+Math.floor(rnd()*899999))+" "+Math.floor(rnd()*10));
 var ms=mat(0xffffff,.55,.3);ms.map=ctex(l,256);var me2=mat(0xffffff,.55,.3);me2.map=ctex(l,128);var mt=mat(l[1],.6,.3);
 var im=new T.InstancedMesh(cg,[me2,me2,mt,mt,ms,ms],a.length);a.forEach(function(m,k){im.setMatrixAt(k,m)});ship.add(im)});

/* superstructure */
function box(w,h,d,x,y,z,mt){var m=new T.Mesh(new T.BoxGeometry(w,h,d),mt);m.position.set(x,y,z);ship.add(m);return m}
function cyl(r1,r2,h,x,y,z,mt){var m=new T.Mesh(new T.CylinderGeometry(r1,r2,h,18),mt);m.position.set(x,y,z);ship.add(m);return m}
var white=mat(0xeeeeea,.6,.05),amber=new T.MeshBasicMaterial({color:0xffcf70});
box(8,6,10.4,-15,8.05,0,white);box(3.2,2.6,11.4,-12.4,12.35,0,white);box(2.2,.4,6.5,-12.6,13.8,0,mat(0xc9cdd0));
box(.12,.8,10.8,-10.78,12.4,0,new T.MeshBasicMaterial({color:0x2a3550}));var bw=box(.14,.8,10.8,-10.76,12.4,0,amber);bw.material=new T.MeshBasicMaterial({color:0xffcf70,transparent:true,opacity:.55});
for(var r=0;r<3;r++)for(var cx=0;cx<6;cx++)[-1,1].forEach(function(s){box(.7,.55,.1,-18+cx*1.2,6.6+r*1.6,s*5.22,amber)});
cyl(1.5,1.7,5,-17,13.5,0,mat(0x0c6b45,.5,.3));cyl(1.62,1.72,1.1,-17,13.5,0,mat(0xf2f2ee,.5,.2));
cyl(.08,.08,5,-12.4,16.3,0,mat(0xdddddd));cyl(.08,.08,6,17,8,0,mat(0xdddddd));box(.1,.1,2.4,17,10,0,mat(0xdddddd));

/* realism: rails, lifeboats, bridge wings, deck gear */
var grey=mat(0xb8bcc2,.5,.5),orng=mat(0xe8702a,.5,.2);
function seg(a,b,c,d,y){var r=box(Math.hypot(c-a,d-b),.1,.07,(a+c)/2,y,(b+d)/2,grey);r.rotation.y=-Math.atan2(d-b,c-a)}
[-1,1].forEach(function(s){[6.1,5.55].forEach(function(y){for(var rx=-19.5;rx<21.6;rx+=1.5){var r2=Math.min(21.7,rx+1.5);seg(rx,s*(Bd(rx)-.25),r2,s*(Bd(r2)-.25),y)}});
 var lb=cyl(.65,.65,4.2,-16,8.9,s*6.2,orng);lb.rotation.z=Math.PI/2;box(.15,1.3,.15,-17.5,8.9,s*6.2,grey);box(.15,1.3,.15,-14.5,8.9,s*6.2,grey);
 cyl(.25,.3,.5,14,5.3,s*5,grey);cyl(.25,.3,.5,19,5.3,s*2.4,grey)});
var pm=new T.InstancedMesh(new T.BoxGeometry(.07,1.15,.07),grey,60),pn=0;[-1,1].forEach(function(s){for(var x=-19.5;x<=21.5;x+=2.2){pm.setMatrixAt(pn++,new T.Matrix4().setPosition(x,5.6,s*(Bd(x)-.25)))}});pm.count=pn;ship.add(pm);[6.1,5.55].forEach(function(y){var bz=Bd(21.7)-.25,az=Bd(-19.5)-.25;seg(21.7,-bz,21.7,bz,y);seg(-19.5,-az,-19.5,az,y)});
box(2.4,.3,14,-12.4,11.5,0,white);var wdl=cyl(.5,.5,2.4,17,5.8,0,grey);wdl.rotation.x=Math.PI/2;
/* hull logo */


/* glow sprites */
var gc=document.createElement("canvas");gc.width=gc.height=64;var gx=gc.getContext("2d"),gr=gx.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,"rgba(255,200,110,1)");gr.addColorStop(.3,"rgba(255,160,60,.45)");gr.addColorStop(1,"rgba(255,140,40,0)");gx.fillStyle=gr;gx.fillRect(0,0,64,64);
var gtex=new T.CanvasTexture(gc),gmat=new T.SpriteMaterial({map:gtex,blending:T.AdditiveBlending,depthWrite:false,transparent:true}),glows=[];
function glow(x,y,z,s){var sp=new T.Sprite(gmat);sp.position.set(x,y,z);sp.scale.set(s,s,1);ship.add(sp)}
glow(-12.4,19,0,3.2);glow(17,11.2,0,2.6);glow(-10.6,12.4,0,5);for(var gl=-9;gl<18;gl+=4)[-1,1].forEach(function(s){glow(gl,5.6,s*(gl<12?6.3:4.2),1.5)});

/* ---- particles ---- */
function Parts(N,color,max){var g=new T.BufferGeometry(),P=new Float32Array(N*3),S=new Float32Array(N),A=new Float32Array(N),Vl=new Float32Array(N*3),age=new Float32Array(N).fill(9),life=new Float32Array(N).fill(1),s0=new Float32Array(N),s1=new Float32Array(N),i=0;
 g.setAttribute("position",new T.BufferAttribute(P,3));g.setAttribute("size",new T.BufferAttribute(S,1));g.setAttribute("alpha",new T.BufferAttribute(A,1));
 var pt=new T.Points(g,new T.ShaderMaterial({uniforms:{uPx:PX,uCol:{value:new T.Color(color)}},transparent:true,depthWrite:false,
  vertexShader:"uniform float uPx;attribute float size;attribute float alpha;varying float vA;void main(){vA=alpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=size*uPx/-mv.z;gl_Position=projectionMatrix*mv;}",
  fragmentShader:"uniform vec3 uCol;varying float vA;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(uCol,smoothstep(.5,0.,d)*vA);}"}));
 pt.frustumCulled=false;scene.add(pt);
 return{mat:pt.material,emit:function(x,y,z,vx,vy,vz,l,a,b){P[i*3]=x;P[i*3+1]=y;P[i*3+2]=z;Vl[i*3]=vx;Vl[i*3+1]=vy;Vl[i*3+2]=vz;life[i]=l;age[i]=0;s0[i]=a;s1[i]=b;i=(i+1)%N},
 update:function(dt,grav){for(var k=0;k<N;k++){age[k]+=dt;var t=age[k]/life[k];if(t>=1){A[k]=0;continue}P[k*3]+=Vl[k*3]*dt;P[k*3+1]+=Vl[k*3+1]*dt;P[k*3+2]+=Vl[k*3+2]*dt;Vl[k*3+1]-=grav*dt;S[k]=s0[k]+(s1[k]-s0[k])*t;A[k]=(t<.12?t/.12:(1-t)/.88)*max}
  g.attributes.position.needsUpdate=g.attributes.size.needsUpdate=g.attributes.alpha.needsUpdate=true}}}
var smoke=Parts(70,0x8f96aa,.4),spray=Parts(1000,0xffffff,.75),acc1=0,acc2=0,tmp=new T.Vector3();

/* ---- lights & themes ---- */
var sun=new T.DirectionalLight(0xffa14a,2.2);sun.position.set(30,12,-40);scene.add(sun);
var fill=new T.DirectionalLight(0xffb070,.5);fill.position.set(-10,15,40);scene.add(fill);
var hemi=new T.HemisphereLight(0x5a6aa0,0x1a2030,.9);scene.add(hemi);
var TH={sunset:{top:[.05,.09,.22],mid:[.5,.3,.5],hor:[1,.62,.28],sc:[1,.7,.35],si:1,deep:[.02,.09,.2],sub:[.05,.22,.38],cd:[.15,.15,.32],cl:[1,.55,.2],cla:.85,dl:0xffa14a,di:2.2,fi:.5,hs:0x5a6aa0,hi:.9,glow:.7},
 night:{top:[.01,.02,.06],mid:[.03,.06,.15],hor:[.06,.12,.25],sc:[0,0,0],si:0,deep:[.01,.04,.1],sub:[.02,.08,.18],cd:[.03,.05,.12],cl:[.1,.16,.35],cla:.75,dl:0x6f8fe0,di:1.1,fi:.9,hs:0x2a3f7a,hi:.7,glow:1.2}};
var mode={};
function setTheme(k){var h=TH[k];U.uTop.value.set.apply(U.uTop.value,h.top);U.uMid.value.set.apply(U.uMid.value,h.mid);U.uHor.value.set.apply(U.uHor.value,h.hor);U.uSunCol.value.set.apply(U.uSunCol.value,h.sc);
 U.uDeep.value.set.apply(U.uDeep.value,h.deep);U.uSub.value.set.apply(U.uSub.value,h.sub);U.uCD.value.set.apply(U.uCD.value,h.cd);U.uCL.value.set.apply(U.uCL.value,h.cl);U.uSunI.value=h.si;U.uCl.value=h.cla;
 sun.color.set(h.dl);sun.intensity=h.di;fill.intensity=h.fi;hemi.color.set(h.hs);hemi.intensity=h.hi;gmat.opacity=h.glow>1?1:h.glow;
 smoke.mat.uniforms.uCol.value.setRGB(h.hor[0]*.3+.35,h.hor[1]*.3+.35,h.hor[2]*.3+.4);
 document.getElementById("t").textContent=TEXT[k][0];document.getElementById("s").textContent=TEXT[k][1];mode.textContent=k=="sunset"?"☾":"☀";if(bloom)bloom.strength=k=="sunset"?.5:.9;cur=k}
var cur=START;setTheme(START);

/* upgrades: shadows, radar, nav lights, gulls */
var rad=box(.25,.15,3.4,-12.4,14.1,0,mat(0x2c323c)),nl=function(c,z){var s=new T.Sprite(new T.SpriteMaterial({map:gtex,color:c,blending:T.AdditiveBlending,depthWrite:false,transparent:true}));s.position.set(-10.8,12.4,z);s.scale.set(2,2,1);ship.add(s)};nl(0xff2020,-7);nl(0x20ff40,7);
ship.traverse(function(o){if(o.isMesh){o.castShadow=o.receiveShadow=true}});
sun.castShadow=true;var sh=sun.shadow;sh.mapSize.set(2048,2048);sh.bias=-.0006;sh.normalBias=.05;Object.assign(sh.camera,{left:-135,right:135,top:135,bottom:-135,near:1,far:330});sh.camera.updateProjectionMatrix();sun.target.position.set(0,5,0);scene.add(sun.target);
var gulls=[];for(var gi=0;gi<4;gi++){var gg=new T.Group(),gm=mat(0xf2f2ee,.8,0);gm.side=T.DoubleSide;var wl=new T.Mesh(new T.PlaneGeometry(.5,1.1).rotateX(-Math.PI/2).translate(0,0,-.55),gm),wr=new T.Mesh(new T.PlaneGeometry(.5,1.1).rotateX(-Math.PI/2).translate(0,0,.55),gm);gg.add(wl,wr,new T.Mesh(new T.SphereGeometry(.17,8,6),gm));gg.visible=false;scene.add(gg);gulls.push({g:gg,l:wl,r:wr})}
/* ---- storm: searchlight, deck lights, rain, lightning, sound ---- */
[[3.2,.05],[6.5,.035]].forEach(function(c){var g2=new T.ConeGeometry(c[0],46,24,1,true);g2.translate(0,-23,0);var m=new T.Mesh(g2,new T.MeshBasicMaterial({color:0xffe0a8,transparent:true,opacity:c[1],blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));m.position.set(17,10.6,0);m.rotation.z=Math.PI/2-.09;ship.add(m)});
var pl1=new T.PointLight(0xffb060,1.6,110);pl1.position.set(-12,14,0);ship.add(pl1);var pl2=new T.PointLight(0xffb060,1.2,90);pl2.position.set(14,9,0);ship.add(pl2);
var RN=1400,rp=new Float32Array(RN*6),ro=new Float32Array(RN*3),rgm=new T.BufferGeometry();
for(var ri=0;ri<RN;ri++){ro[ri*3]=(rnd()-.5)*140;ro[ri*3+1]=rnd()*60;ro[ri*3+2]=-110+rnd()*130}
rgm.setAttribute("position",new T.BufferAttribute(rp,3));
var rain=new T.LineSegments(rgm,new T.LineBasicMaterial({color:0xa9bde0,transparent:true,opacity:.26,fog:false,depthWrite:false}));rain.frustumCulled=false;scene.add(rain);
function rainUpdate(dt){var c=cam.position;for(var i=0;i<RN;i++){var o=i*3,y=ro[o+1]-60*dt;if(y<0)y+=60;ro[o+1]=y;var x=c.x+ro[o],z=c.z+ro[o+2],q=i*6;rp[q]=x;rp[q+1]=y;rp[q+2]=z;rp[q+3]=x+.25;rp[q+4]=y+1.8;rp[q+5]=z+.12}rgm.attributes.position.needsUpdate=true}
var AC=null,snd=false,horned=false,nf=6,ff=-9,sb=document.getElementById("snd");
function noiseBuf(sec,k){var n=AC.sampleRate*sec,b=AC.createBuffer(1,n,AC.sampleRate),d=b.getChannelData(0),l=0;for(var i=0;i<n;i++){l=(l+.02*(Math.random()*2-1))/1.02;d[i]=l*k}return b}
function audioInit(){AC=new(window.AudioContext||window.webkitAudioContext)();var m=AC.createGain();m.gain.value=.55;m.connect(AC.destination);AC.m=m;
 var s=AC.createBufferSource();s.buffer=noiseBuf(3,3.5);s.loop=true;var f=AC.createBiquadFilter();f.frequency.value=450;s.connect(f);f.connect(m);s.start();
 var o=AC.createOscillator();o.type="sawtooth";o.frequency.value=44;var lf=AC.createBiquadFilter();lf.frequency.value=150;var g=AC.createGain();g.gain.value=.04;o.connect(lf);lf.connect(g);g.connect(m);o.start();AC.eng=g}
function horn(){var t0=AC.currentTime,g=AC.createGain(),f=AC.createBiquadFilter();f.frequency.value=700;g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(.3,t0+.2);g.gain.setValueAtTime(.3,t0+2);g.gain.linearRampToValueAtTime(0,t0+2.8);[98,147,196].forEach(function(fr){var o=AC.createOscillator();o.type="sawtooth";o.frequency.value=fr;o.connect(f);o.start(t0);o.stop(t0+2.9)});f.connect(g);g.connect(AC.m)}
function thunder(){if(!snd)return;var t0=AC.currentTime,s=AC.createBufferSource();s.buffer=noiseBuf(3,5);var f=AC.createBiquadFilter();f.frequency.value=260;var g=AC.createGain();g.gain.setValueAtTime(.9,t0);g.gain.exponentialRampToValueAtTime(.001,t0+3);s.connect(f);f.connect(g);g.connect(AC.m);s.start(t0)}
sb.onclick=function(){if(!AC)audioInit();snd=!snd;if(snd)AC.resume();else AC.suspend();sb.textContent=snd?"\u{1F50A} SOUND ON":"\u{1F507} SOUND OFF"};
function stormUpdate(t,dt){
 if(t>nf){ff=t;nf=t+8+Math.random()*10;if(snd)setTimeout(thunder,500+Math.random()*1200)}
 var tt=t-ff,fl=tt<.6?Math.exp(-tt*8)*(.65+.35*Math.sin(tt*60)):0;
 U.uTop.value.set(.01+fl*.22,.02+fl*.27,.06+fl*.42);U.uMid.value.set(.03+fl*.3,.06+fl*.36,.15+fl*.5);U.uHor.value.set(.06+fl*.22,.12+fl*.28,.25+fl*.4);U.uCL.value.set(.1+fl*.8,.16+fl*.85,.35+fl*.9);
 hemi.intensity=.7+fl*3.2;sun.intensity=1.1+fl*2.2;rainUpdate(dt);
 if(snd){AC.eng.gain.value=.04+.1*PV/100;if(PV>=99&&!horned){horned=true;horn()}}if(PV<50)horned=false}
/* ---- cargo plane crossing the centre of the moon ---- */
var plane=new T.Group(),pb=new T.Group(),PKU={uRim:{value:1}},PK=new T.ShaderMaterial({uniforms:PKU,side:T.DoubleSide,vertexShader:"varying vec3 vN,vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}",fragmentShader:"uniform float uRim;varying vec3 vN,vV;void main(){vec3 n=normalize(vN);float r=pow(1.-abs(dot(n,normalize(vV))),2.2);vec3 up=normalize((viewMatrix*vec4(0.,1.,0.,0.)).xyz);float top=.3+.7*max(dot(n,up),0.);gl_FragColor=vec4(vec3(.035,.05,.09)+vec3(.55,.72,1.)*r*top*uRim,1.);}"}),PD=700,PA=.35,pdir=new T.Vector3(),pd2=new T.Vector3(Math.cos(PA),0,Math.sin(PA)),psn=null,psg=null,psp=null;
function pmesh(g,x,y,z){var m=new T.Mesh(g,PK);m.position.set(x,y,z);pb.add(m);return m}
pmesh(new T.CylinderGeometry(3.6,3.6,62,14).rotateZ(Math.PI/2),0,0,0);
pmesh(new T.CylinderGeometry(.8,3.6,12,14).rotateZ(-Math.PI/2),37,0,0);
pmesh(new T.CylinderGeometry(3.6,.8,16,14).rotateZ(-Math.PI/2),-39,.6,0);
pmesh(new T.SphereGeometry(1,16,10).scale(15,3.2,3.2),22,3.6,0);
function wing(pts,y,depth){var w2=new T.Shape();w2.moveTo(pts[0][0],pts[0][1]);for(var i=1;i<pts.length;i++)w2.lineTo(pts[i][0],pts[i][1]);var g=new T.ExtrudeGeometry(w2,{depth:depth,bevelEnabled:false}).rotateX(-Math.PI/2);pmesh(g,0,y,0);pmesh(g,0,y,0).scale.z=-1}
wing([[8,3],[-8,36],[-14,36],[-6,3]],-1.8,.7);wing([[-33,2],[-41,13],[-45,13],[-40,2]],1,.5);
var fs=new T.Shape();fs.moveTo(-28,3);fs.lineTo(-42,3);fs.lineTo(-45,18);fs.lineTo(-39,18);fs.lineTo(-28,3);pmesh(new T.ExtrudeGeometry(fs,{depth:.8,bevelEnabled:false}).translate(0,0,-.4),0,0,0);
[[6,12],[1.8,22]].forEach(function(e){[-1,1].forEach(function(s2){pmesh(new T.CylinderGeometry(1.5,1.5,7,10).rotateZ(Math.PI/2),e[0],-3.8,s2*e[1])})});
function nl2(x,y,z,c,sz2){var sp=new T.Sprite(new T.SpriteMaterial({map:gtex,color:c,blending:T.AdditiveBlending,depthWrite:false,transparent:true,fog:false}));sp.position.set(x,y,z);sp.scale.set(sz2,sz2,1);pb.add(sp);return sp}
var lR=nl2(-11,-1.5,-36,0xff2020,14),lG=nl2(-11,-1.5,36,0x20ff50,14),wS1=nl2(-12,-1.5,-36,0xffffff,22),wS2=nl2(-12,-1.5,36,0xffffff,22),tB=nl2(-43,18.5,0,0xff3030,16);
var tc=document.createElement("canvas");tc.width=128;tc.height=4;var tx=tc.getContext("2d"),tgr=tx.createLinearGradient(0,0,128,0);tgr.addColorStop(0,"rgba(190,210,255,0)");tgr.addColorStop(1,"rgba(190,210,255,.65)");tx.fillStyle=tgr;tx.fillRect(0,0,128,4);
var tm=new T.MeshBasicMaterial({map:new T.CanvasTexture(tc),transparent:true,depthWrite:false,fog:false,side:T.DoubleSide});
[-12,12].forEach(function(z){var tr2=new T.Mesh(new T.PlaneGeometry(150,1.6),tm);tr2.position.set(-78,-3.8,z);pb.add(tr2)});
plane.add(pb);plane.scale.setScalar(2);plane.visible=false;scene.add(plane);
var sxS=-900,T0=null,wClose=0,lbh=0,lb1=document.createElement("div"),lb2=document.createElement("div");[lb1,lb2].forEach(function(b,i){b.style.cssText="position:fixed;left:0;right:0;height:0;background:#000;z-index:1;pointer-events:none;transition:height 1.2s ease;"+(i?"bottom:0":"top:0");document.body.appendChild(b)});
function planeUpdate(t,dt){var P=PV;if(P<lastP-30)T0=null;lastP=P;if(T0===null)T0=t;var sx=T0===null?-9999:(t-T0-12)*62,on=sx>-760&&sx<780;plane.visible=on;PKU.uRim.value=.12+.88*(1-Math.exp(-sx*sx/9000));if(bloom)bloom.strength=.9-.6*Math.max(Math.exp(-sx*sx/12000),wClose);var bh=P>=72?7.5:0;if(bh!==lbh){lbh=bh;lb1.style.height=lb2.style.height=bh+"vh"}var fv=45-3*Math.min(1,Math.max(0,(P-82)/14));if(Math.abs(fv-cam.fov)>.02){cam.fov=fv;cam.updateProjectionMatrix();PX.value=R.domElement.height/(2*Math.tan(fv*Math.PI/360))}
 if(on){pdir.copy(U.uSun.value).multiplyScalar(PD);plane.position.copy(cam.position).add(pdir).addScaledVector(pd2,sx);plane.rotation.y=-PA;pb.rotation.x=Math.sin(t*.7)*.04;pb.rotation.z=.03;
  var ph=(t*1.2)%1,st=(ph<.07||(ph>.17&&ph<.24))?1:0;wS1.material.opacity=st;wS2.material.opacity=st;tB.material.opacity=(t%1.6)<.14?1:.1;lR.material.opacity=lG.material.opacity=.8+.2*Math.sin(t*3)}
 if(snd&&on){if(!psn){psn=AC.createBufferSource();psn.buffer=noiseBuf(14,4);var f=AC.createBiquadFilter();f.frequency.value=300;psg=AC.createGain();psp=AC.createStereoPanner?AC.createStereoPanner():null;psn.connect(f);f.connect(psg);if(psp){psg.connect(psp);psp.connect(AC.m)}else psg.connect(AC.m);psn.start()}
  psg.gain.value=.5*Math.max(0,1-Math.abs(sx)/780);if(psp)psp.pan.value=Math.max(-1,Math.min(1,sx/500))}
 else if(psn){psn.stop();psn=null}}
try{var cub=new T.WebGLCubeRenderTarget(128),cubCam=new T.CubeCamera(1,3000,cub);cubCam.position.set(0,12,0);scene.add(cubCam);
var hid=[rig,sea,rain,plane],hv=hid.map(function(o){return o.visible});hid.forEach(function(o){o.visible=false});cubCam.update(R,scene);hid.forEach(function(o,i){o.visible=hv[i]});
ship.traverse(function(o){[].concat(o.material||[]).forEach(function(m){if(m.isMeshStandardMaterial){m.envMap=cub.texture;m.envMapIntensity=.5;m.needsUpdate=true}})})}catch(e){}
/* ---- dolphin pod (12) riding the bow wave ---- */
var DN=12,DL=[],dg=new T.LatheGeometry([[0,-1.9],[.12,-1.75],[.28,-1.2],[.5,-.4],[.62,.3],[.55,.9],[.34,1.45],[.2,1.75],[.12,1.95],[0,2.05]].map(function(q){return new T.Vector2(q[0],q[1])}),14).rotateX(Math.PI/2);
(function(){var n=dg.attributes.normal,c=new Float32Array(n.count*3),a=[.78,.84,.88],b=[.34,.45,.56];for(var i=0;i<n.count;i++){var k=Math.min(1,Math.max(0,(n.getY(i)+.25)/.7));for(var q=0;q<3;q++)c[i*3+q]=a[q]+(b[q]-a[q])*k}dg.setAttribute("color",new T.BufferAttribute(c,3))})();
var dm=new T.MeshStandardMaterial({vertexColors:true,roughness:.35,metalness:.05,side:T.DoubleSide});if(typeof cub!=="undefined"&&cub){dm.envMap=cub.texture;dm.envMapIntensity=.6}
function dolphin(){var g=new T.Group(),b=new T.Mesh(dg,dm);b.scale.set(1,.9,1);g.add(b);
 var df=new T.Mesh(new T.ConeGeometry(.3,.85,8),dm);df.position.set(0,.62,-.15);df.rotation.x=-.5;g.add(df);
 [-1,1].forEach(function(s){var pf=new T.Mesh(new T.ConeGeometry(.16,.8,6),dm);pf.position.set(s*.5,-.35,.55);pf.rotation.set(-.5,0,-s*1.9);g.add(pf)});
 var tl2=new T.Group();tl2.position.set(0,0,-1.8);[-1,1].forEach(function(s){var fl=new T.Mesh(new T.BoxGeometry(.8,.06,.38),dm);fl.position.set(s*.4,0,-.1);fl.rotation.y=s*.45;tl2.add(fl)});g.add(tl2);g.userData.tail=tl2;g.scale.setScalar(2.5);return g}
for(var di=0;di<DN;di++){var dgp=dolphin();dgp.visible=false;scene.add(dgp);DL.push({g:dgp,x0:(di%2?1:-1)*(19+rnd()*20),z0:-15+rnd()*60,P:3.2+rnd()*1.8,ph:rnd(),h:6+rnd()*4,Dd:30+rnd()*10,lu:0,seen:0})}

function splash(x,y,z){for(var k=0;k<12;k++)spray.emit(x+(rnd()-.5)*3,y,z+(rnd()-.5)*3,(rnd()-.5)*6,4+rnd()*6,(rnd()-.3)*5,.8+rnd()*.7,2.4,7)}
function dolphinUpdate(t){var sz=rig.position.z;DL.forEach(function(d,i){var cu=t/d.P+d.ph,cyc=Math.floor(cu),u=cu-cyc,ang=u*2*Math.PI;
 var x=d.x0+2.5*Math.sin(cyc*2.3+i),z=sz+d.z0+u*d.Dd,wy=H(x,z,t),arc=u<.5?d.h*Math.sin(ang):0;
 if(u<d.lu&&d.lu>.9)splash(x,wy,z);if(d.lu<.5&&u>=.5)splash(x,wy,z);d.lu=u;
 var on=u<.5&&!bk.on;d.g.visible=on;if(!on)return;
 var th=Math.atan2(d.h*2*Math.PI*Math.cos(ang),d.Dd);d.g.position.set(x,wy+arc-.35,z);d.g.rotation.set(-th,0,Math.sin(t*3+i)*.1);d.g.userData.tail.rotation.x=Math.sin(t*9+i)*.4;
 })}
/* ---- progress ---- */
var ring=document.getElementById("rg"),pct=document.getElementById("pc"),p=0,auto=true,PV=0,fb={style:{set width(v){var n=Math.max(0,Math.min(100,parseFloat(v)||0));PV=n;ring.style.strokeDashoffset=251.33*(1-n/100);pct.textContent=Math.round(n)+"%";var st=STAGES[n<35?0:n<75?1:n<97?2:3],se=document.getElementById("s");if(se.textContent!==st)se.textContent=st}}};
window.setProgress=function(v){auto=false;fb.style.width=Math.max(0,Math.min(100,v))+"%";if(v>=99.5&&!finishing){finishing=true;leave(HOLD)}};

/* ---- loop ---- */
var comp=null,bloom=null,fa=.016,grade=null;
var tg=new T.Vector3(2,9,0),mode="cine",cb=1,cineFrom=new T.Vector3(),oc={},drag=false;function resize(){var w=innerWidth,h=innerHeight;R.setSize(w,h,false);if(comp)comp.setSize(w,h);cam.aspect=w/h;cam.updateProjectionMatrix();PX.value=R.domElement.height/(2*Math.tan(cam.fov*Math.PI/360))}
addEventListener("resize",resize);resize();try{if(T.EffectComposer&&T.UnrealBloomPass){comp=new T.EffectComposer(R);comp.addPass(new T.RenderPass(scene,cam));bloom=new T.UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),cur=="sunset"?.5:.9,.6,.82);comp.addPass(bloom);grade=new T.ShaderPass({uniforms:{tDiffuse:{value:null},uT:{value:0}},vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:"uniform sampler2D tDiffuse;uniform float uT;varying vec2 vUv;float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}void main(){vec2 c=vUv-.5;float d=dot(c,c);vec2 o=c*d*.014;vec3 col=vec3(texture2D(tDiffuse,vUv+o).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-o).b);col=clamp(col,0.,1.);float l=dot(col,vec3(.299,.587,.114));col+=vec3(-.004,.007,.02)*(1.-l);col=mix(col,col*col*(3.-2.*col),.3);col=mix(vec3(l),col,1.1);col*=1.-smoothstep(.1,.5,d)*.5;col+=(h(vUv*vec2(1920.,1080.)+fract(uT)*91.)-.5)*.03;gl_FragColor=vec4(col,1.);}"});comp.addPass(grade);comp.setSize(innerWidth,innerHeight)}}catch(e){comp=null}
var clock=new T.Clock(),pr=0,rl=0,py=0,prevBow=0;var bk={on:0,t:0,ya:0,yv:0,ep:0,ev:0,z0:0,d:1,v:1,n:2,T:3,k:1},zv=0,lastP=0;
function frameInner(){var rawDt=clock.getDelta(),dt=Math.min(rawDt,.05),t=U.uTime.value+dt;U.uTime.value=t;
 var u0=PV/100,zO=rig.position.z,vel,vr=0,zE=Math.max(-150,92*Math.max(1,1.2/cam.aspect)-Math.max(120,100/(.38*cam.aspect)));
 if(PV<45&&bk.on){bk.on=0;bk.ya=bk.yv=bk.ep=bk.ev=zv=0;rig.position.x=0;rig.rotation.y=-Math.PI/2}
 if(!bk.on){var s0=Math.min(1,u0/.86),zt=-330+(zE-45+330)*(.35*s0+.65*s0*s0);rig.position.z+=Math.max(-50*dt,Math.min(50*dt,(zt-zO)*Math.min(1,dt*6)));zv+=((rig.position.z-zO)/Math.max(dt,.001)-zv)*Math.min(1,dt*8);vel=zv;
  if(u0>=.86){bk.on=1;bk.t=0;bk.z0=rig.position.z;bk.d=Math.max(12,zE-bk.z0);bk.v=Math.max(zv,8);bk.n=Math.min(2.6,Math.max(1.4,bk.v*6.5/bk.d));bk.T=bk.n*bk.d/bk.v;bk.k=Math.min(1.3,Math.max(.45,bk.v/24))}}
 else{bk.t+=dt;var s1=Math.min(1,bk.t/bk.T);rig.position.z=bk.z0+bk.d*(1-Math.pow(1-s1,bk.n));vel=bk.d*bk.n/bk.T*Math.pow(1-s1,bk.n-1);zv=vel;vr=vel/bk.v;
  var yt=bk.t>bk.T*.12?1.5708:0;bk.yv+=(3.5*(yt-bk.ya)-2.7*bk.yv)*dt;bk.ya+=bk.yv*dt;bk.ev+=(30*(-.055*bk.k*vr-bk.ep)-3.6*bk.ev)*dt;bk.ep+=bk.ev*dt;rig.position.x+=vel*.25*Math.sin(bk.ya)*dt;rig.rotation.y=-Math.PI/2+bk.ya}
 U.uYaw.value=bk.ya;U.uSk.value=Math.min(1,vr*1.2+Math.abs(bk.yv)*.3);U.uSpd.value+=(Math.min(1,vel/18)-U.uSpd.value)*Math.min(1,dt*.8);
 var sz=rig.position.z,ue=Math.min(1,Math.max(0,(sz+330)/325)),um=ue*ue*(3-2*ue),me=(14+12*um)*Math.PI/180;U.uSun.value.set(0,Math.sin(me),-Math.cos(me));sun.position.set(0,Math.sin(me)*95,sz-Math.cos(me)*95);sun.target.position.set(0,8,sz);U.uShip.value.set(rig.position.x,sz);var hc=(H(0,sz,t)+H(0,sz+36,t)+H(0,sz-36,t)+H(15,sz,t)+H(-15,sz,t))/5,tp=Math.atan2(H(0,sz+36,t)-H(0,sz-36,t),72)*.9,tr=-Math.atan2(H(-15,sz,t)-H(15,sz,t),30)*.9,k=Math.min(1,dt*2);
 py+=(hc*.85+.5-py)*k;pr+=(tp-pr)*k;rl+=(tr-rl)*k;ship.position.y=py;ship.rotation.z=pr+bk.ep;ship.rotation.x=rl+.05*bk.yv;ship.rotation.y=Math.sin(t*.2)*.015;rig.updateMatrixWorld(true);
 var bowY=ship.localToWorld(tmp.set(16,0,0)).y,bv=(bowY-prevBow)/Math.max(dt,.001);prevBow=bowY;
 acc1+=dt*13;while(acc1>1){acc1--;ship.localToWorld(tmp.set(-17,16,0));smoke.emit(tmp.x,tmp.y,tmp.z,(rnd()-.5)*.8,2.2+rnd(),-3-rnd()*1.5,5,4.2,19)}
 acc2+=dt*(170+Math.max(0,-bv)*14+(bk.on?400*bk.k*vr:0));while(acc2>1){acc2--;var x=4+rnd()*17,hw=Wb(x)+.1,s=rnd()<.5?-1:1,f=Math.max(0,(x-4)/17),ld=bk.on&&(vr>.12||Math.abs(bk.yv)>.2)&&rnd()<.6;if(ld){x=-12+rnd()*26;hw=Wb(x);s=bk.ya>0?1:-1;f=1+bk.k}
  ship.localToWorld(tmp.set(x,-.4,s*hw));spray.emit(tmp.x,tmp.y,tmp.z,-s*(.8+rnd()*2.5)*(ld?2.2:1),1.5+rnd()*5*f+rnd()*2,-4-rnd()*4+(ld?vel*.5:0),.7+rnd()*.7,1.3,4.2)}
 smoke.update(dt,-.2);spray.update(dt,9);
 gulls.forEach(function(o,i){var a=t*.3+i*1.6,Rr=24+i*6,vx=-Math.sin(a)*1.3,vz=Math.cos(a)*.9;o.g.position.set(Math.cos(a)*Rr*1.3,10+Math.sin(t*.5+i)*2.5+i*1.5,Math.sin(a)*Rr*.9);o.g.rotation.y=-Math.atan2(vz,vx);var w=Math.sin(t*9+i*2)*.55;o.l.rotation.x=w;o.r.rotation.x=-w});rad.rotation.y=t*3;
 var asp=cam.aspect,fz=1.3*Math.max(1,1.2/asp),SH=[[-12,10,40,1.5,9,0],[32,7,24,6,10,0],[-34,22,24,0,8,0],[6,8,-36,3,10,0],[-4,38,30,3,6,0]],sg=t/9,si=Math.floor(sg)%5,sj=(si+1)%5,uu=Math.min(1,Math.max(0,(sg%1-.72)/.28)),ee=uu*uu*(3-2*uu),A=SH[si],B=SH[sj],M=function(i){return A[i]+(B[i]-A[i])*ee};
 tg.set(0,9,rig.position.z);if(mode=="cine"){var pp=new T.Vector3(Math.sin(t*.13)*3,12+6*um+Math.sin(t*.2)*.5+Math.sin(t*1.3)*.05,92*Math.max(1,1.2/asp)),tl=new T.Vector3(rig.position.x*.7,pp.y+(pp.z-rig.position.z)*Math.tan(.08+.12*um),rig.position.z);
  if(cb<1){cb=Math.min(1,cb+dt*.7);var q2=cb*cb*(3-2*cb);pp.lerpVectors(cineFrom,pp,q2);tl.lerpVectors(tg,tl,q2)}
  pp.y+=H(pp.x,pp.z,t)*.35;cam.position.copy(pp);cam.lookAt(tl);cam.rotateZ(Math.sin(t*.45)*.014)}
 else{
  if(mode=="orbit"){oc.az+=dt*.12;oc.el+=(.2+.06*Math.sin(t*.2)-oc.el)*Math.min(1,dt*2);oc.r+=(46*fz-oc.r)*Math.min(1,dt*2)}
  else if(!drag){oc.az+=oc.vaz*dt;oc.vaz*=Math.pow(.05,dt)}
  var ce=Math.cos(oc.el),cx=tg.x+oc.r*ce*Math.cos(oc.az),cz=tg.z+oc.r*ce*Math.sin(oc.az),cy=Math.max(tg.y+oc.r*Math.sin(oc.el),H(cx,cz,t)+1.6);
  cam.position.set(cx,cy,cz);cam.lookAt(tg)}
 if(auto){var cap=(CFG.ready&&!CFG.ready())?99:100;p=Math.min(cap,p+dt*K*(p<86?4.6:2));fb.style.width=p+"%";if(p>=99.5&&!finishing){finishing=true;auto=false;leave(HOLD)}}
 slowEma=slowEma*.95+rawDt*.05;if(CFG.minFps>0&&t>6&&!finishing&&R.getPixelRatio()<=1&&slowEma>1/CFG.minFps){finishing=true;auto=false;leave(0)}
 fa=fa*.97+dt*.03;if(t>4&&fa>.037&&R.getPixelRatio()>1){R.setPixelRatio(Math.max(1,R.getPixelRatio()-.25));if(comp)comp.setPixelRatio(R.getPixelRatio());resize();fa=.016}
 stormUpdate(t,dt);planeUpdate(t,dt);if(grade)grade.uniforms.uT.value=t;dolphinUpdate(t);var fw=new T.Vector3();cam.getWorldDirection(fw);fw.y=0;fw.normalize();var cs=700/360;sea.position.set(Math.round((cam.position.x+fw.x*140)/cs)*cs,0,Math.round((cam.position.z+fw.z*140)/cs)*cs);
 comp?comp.render(dt):R.render(scene,cam);requestAnimationFrame(frame)}
function frame(){if(dead)return;try{frameInner()}catch(e){fail(e)}}
cv.addEventListener("webglcontextlost",function(e){e.preventDefault();fail(new Error("WebGL context lost"))});
frame();
if(!dead)window.__shipLoaderStarted=true;
})();
