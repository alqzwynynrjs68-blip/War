/* WORLD DOMINION - embedded country and ADM1 boundaries; no network fetch required */
const countries = [
 {id:'IRQ',en:'Iraq',ar:'العراق',flag:'🇮🇶',count:18},
 {id:'SAU',en:'Saudi Arabia',ar:'السعودية',flag:'🇸🇦',count:13},
 {id:'IRN',en:'Iran',ar:'إيران',flag:'🇮🇷',count:31},
 {id:'KWT',en:'Kuwait',ar:'الكويت',flag:'🇰🇼',count:6},
 {id:'QAT',en:'Qatar',ar:'قطر',flag:'🇶🇦',count:8},
 {id:'BHR',en:'Bahrain',ar:'البحرين',flag:'🇧🇭',count:4},
 {id:'ARE',en:'United Arab Emirates',ar:'الإمارات',flag:'🇦🇪',count:7},
 {id:'OMN',en:'Oman',ar:'عُمان',flag:'🇴🇲',count:7}
];
const $=id=>document.getElementById(id);
const NS='http://www.w3.org/2000/svg';
const geo=window.WD_COUNTRIES;
const adminGeo=window.WD_ADMIN_REGIONS;
let svg,baseGroup,adminGroup,countryBorderGroup,view={x:0,y:0,w:1000,h:650},selectedCountry=null,selectedRegion=null,adminFeatures=[],adminPaths=[],countryBorderPaths=[],overviewViewWidth=222;
const project=([lon,lat])=>[(lon+180)/360*1000,(90-lat)/180*650];
function ringsToPath(coords){return coords.map(r=>r.map((pt,i)=>{const [x,y]=project(pt);return (i?'L':'M')+x.toFixed(2)+','+y.toFixed(2)}).join(' ')+' Z').join(' ')}
function geometryPath(g){if(!g)return '';if(g.type==='Polygon')return ringsToPath(g.coordinates);if(g.type==='MultiPolygon')return g.coordinates.map(ringsToPath).join(' ');return ''}
function addSvg(tag,attrs,parent){const e=document.createElementNS(NS,tag);Object.entries(attrs||{}).forEach(([k,v])=>e.setAttribute(k,v));parent.appendChild(e);return e}
function updateView(){
 svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
 // Calibrate province visibility against the actual full-Gulf overview width.
 // At the overview (or farther out) province borders are fully hidden.
 // They fade in only after the camera zooms meaningfully into the map.
 const hideAt=overviewViewWidth*0.985;
 const fullAt=overviewViewWidth*0.70;
 const t=Math.max(0,Math.min(1,(hideAt-view.w)/(hideAt-fullAt)));
 if(adminGroup){
   adminGroup.style.opacity=String(t);
   adminGroup.style.visibility=t<0.015?'hidden':'visible';
   adminGroup.style.display=t<0.015?'none':'inline';
   adminGroup.style.pointerEvents=t>=0.45?'auto':'none';
 }
}
function boundsForGeometry(g){let pts=[];const scan=x=>{if(typeof x[0]==='number')pts.push(project(x));else x.forEach(scan)};scan(g.coordinates);let xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}}
function zoom(f,cx=view.x+view.w/2,cy=view.y+view.h/2){const minW=.015,maxW=3000;let nw=Math.min(maxW,Math.max(minW,view.w/f)),scale=nw/view.w,nh=view.h*scale;let rx=(cx-view.x)/view.w,ry=(cy-view.y)/view.h;view={x:cx-rx*nw,y:cy-ry*nh,w:nw,h:nh};updateView()}
function fit(b,pad=30){let w=Math.max(30,b.w+pad*2),h=Math.max(30,b.h+pad*2),s=Math.min(1000/w,650/h);view={x:b.x-(1000-w*s)/2/s,y:b.y-(650-h*s)/2/s,w:1000/s,h:650/s};updateView()}
function getName(f){let p=f.properties||{};return p.shapeName||p.NAME_1||p.name_local||p.name_ar||p.name_en||p.name||p.admin||p.NAME||'منطقة'}
function status(t){$('mapStatus').textContent=t}
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2800)}
function paintCountries(){
 baseGroup.querySelectorAll('path').forEach(p=>{
   let active=selectedCountry&&p.dataset.id===selectedCountry.id;
   p.setAttribute('fill',active?'#b99a62':'#18283b');
   p.setAttribute('fill-opacity',active?'1':'.78');
   // Country borders are drawn in a dedicated top layer below.
   p.setAttribute('stroke','none');
 });
 countryBorderPaths.forEach(({id,path})=>{
   const active=selectedCountry&&id===selectedCountry.id;
   path.setAttribute('stroke',active?'#e6c98f':'#8192a5');
   path.setAttribute('stroke-width',active?'4.6':'3.8');
   path.setAttribute('stroke-opacity',active?'1':'.88');
 });
}
function updateRegionList(c){
 $('regionTitle').textContent='مناطق '+c.ar;
 $('regionCount').textContent='—';
 $('regionList').innerHTML='';
 const features=adminGeo.features.filter(f=>f.properties&&f.properties.shapeGroup===c.id&&f.geometry);
 $('regionCount').textContent=features.length+' منطقة';
 if(!features.length){$('regionList').innerHTML='<div class="loading-regions error">لا توجد حدود إدارية لهذه الدولة في الملف المرفق.</div>';return;}
 features.forEach(f=>{let b=document.createElement('button');b.className='region-btn';b.textContent=getName(f);b.onclick=()=>chooseRegion(f);$('regionList').appendChild(b)});
 if(c.id==='OMN'){
   const note=document.createElement('div');note.className='loading-regions';
   note.textContent='تنبيه: الملف المرسل يحتوي على 7 وحدات إدارية لعُمان فقط، وليس 11. لم تتم إضافة مناطق غير موجودة في المصدر.';
   $('regionList').prepend(note);
 }
 if(features.length!==c.count){$('regionCount').classList.add('count-warning')}else $('regionCount').classList.remove('count-warning');
}
function paintAdminRegions(){
 adminPaths.forEach(({feature,path})=>{
   const active=selectedRegion===feature;
   const countryActive=selectedCountry&&feature.properties.shapeGroup===selectedCountry.id;
   path.setAttribute('fill',active?'#e2bd75':'#76684f');
   path.setAttribute('fill-opacity',active?'.40':(countryActive?'.055':'.025'));
   path.setAttribute('stroke',active?'#fff0c5':'#e0c795');
   path.setAttribute('stroke-width',active?'1.15':'.58');
   path.setAttribute('stroke-opacity',active?'1':'.88');
 });
}
function chooseRegion(f){
 const c=countries.find(x=>x.id===f.properties.shapeGroup);
 if(c&&selectedCountry?.id!==c.id)chooseCountry(c.id,false);
 selectedRegion=f;paintAdminRegions();
 let n=getName(f);$('selectedRegionName').textContent=n;$('selectedRegionHint').textContent='تم تحديد المنطقة';
 document.querySelectorAll('.region-btn').forEach(b=>b.classList.toggle('active',b.textContent===n));
 status('الدولة: '+(c?c.ar:selectedCountry?.ar||'')+' · المنطقة: '+n);
}
function renderAllAdminRegions(){
 adminGroup.innerHTML='';adminPaths=[];
 if(!adminGeo||!Array.isArray(adminGeo.features))return;
 const allowed=new Set(countries.map(c=>c.id));
 adminGeo.features.forEach(f=>{
   if(!f.geometry||!f.properties||!allowed.has(f.properties.shapeGroup))return;
   const path=addSvg('path',{d:geometryPath(f.geometry),fill:'#9b8968','fill-opacity':'.14',stroke:'#e0c795','stroke-width':'.58','stroke-opacity':'.98','vector-effect':'non-scaling-stroke',class:'admin-shape'},adminGroup);
   path.addEventListener('click',e=>{e.stopPropagation();chooseRegion(f)});
   adminPaths.push({feature:f,path});
 });
}
function chooseCountry(id,fitMap=true){
 let c=countries.find(x=>x.id===id);if(!c)return;
 const changed=selectedCountry?.id!==id;
 selectedCountry=c;
 if(changed){selectedRegion=null;$('selectedRegionName').textContent='لم تختر منطقة';$('selectedRegionHint').textContent='قرّب الخريطة ثم اضغط على منطقة';}
 $('selectedName').textContent=c.ar;$('selectedHint').textContent='تم تحديد الدولة';$('confirmCountry').disabled=false;
 document.querySelectorAll('.country-btn').forEach(b=>b.classList.toggle('active',b.dataset.country===id));
 paintCountries();paintAdminRegions();
 let f=geo.features.find(f=>f.properties.iso_a3===id);if(f&&fitMap)fit(boundsForGeometry(f.geometry),60);
 status('تم تحديد '+c.ar);updateRegionList(c);
}
function init(){let map=$('map');map.innerHTML='';svg=addSvg('svg',{viewBox:'0 0 1000 650',role:'img','aria-label':'خريطة الدول الثماني','preserveAspectRatio':'xMidYMid meet'},map);addSvg('rect',{x:0,y:0,width:1000,height:650,fill:'#091321'},svg);baseGroup=addSvg('g',{},svg);adminGroup=addSvg('g',{},svg);countryBorderGroup=addSvg('g',{'pointer-events':'none'},svg);
geo.features.forEach(f=>{let id=f.properties.iso_a3,c=countries.find(x=>x.id===id);if(!c)return;let p=addSvg('path',{d:geometryPath(f.geometry),fill:'#18283b','fill-opacity':'.78',stroke:'#53657a','stroke-width':'1.2','vector-effect':'non-scaling-stroke',class:'country-shape','data-id':id},baseGroup);p.addEventListener('click',()=>chooseCountry(id))});
renderAllAdminRegions();
 // Draw national borders above the province layer so they stay thick and crisp.
 countryBorderPaths=[];
 geo.features.forEach(f=>{
   const id=f.properties.iso_a3;
   if(!countries.some(c=>c.id===id))return;
   const path=addSvg('path',{d:geometryPath(f.geometry),fill:'none',stroke:'#8192a5','stroke-width':'3.8','stroke-opacity':'.98','vector-effect':'non-scaling-stroke'},countryBorderGroup);
   countryBorderPaths.push({id,path});
 });
 let all=geo.features.map(f=>boundsForGeometry(f.geometry));let b={x:Math.min(...all.map(x=>x.x)),y:Math.min(...all.map(x=>x.y)),w:Math.max(...all.map(x=>x.x+x.w))-Math.min(...all.map(x=>x.x)),h:Math.max(...all.map(x=>x.y+x.h))-Math.min(...all.map(x=>x.y))};fit(b,30);overviewViewWidth=view.w;paintCountries();paintAdminRegions();updateView();
countries.forEach(c=>{let btn=document.createElement('button');btn.className='country-btn';btn.dataset.country=c.id;btn.innerHTML=`<span class="flag">${c.flag}</span>${c.ar}`;btn.onclick=()=>chooseCountry(c.id);$('countryList').appendChild(btn)});
// Pointer drag and pinch zoom, plus mouse wheel zoom.
let pts=new Map(),drag=null,lastDist=0;const toSvg=e=>{let r=svg.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*view.w+view.x,y:(e.clientY-r.top)/r.height*view.h+view.y}};
svg.addEventListener('pointerdown',e=>{svg.setPointerCapture(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pts.size===1)drag={x:e.clientX,y:e.clientY,vx:view.x,vy:view.y};if(pts.size===2){let a=[...pts.values()];lastDist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);drag=null}});
svg.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pts.size===1&&drag){let r=svg.getBoundingClientRect();view.x=drag.vx-(e.clientX-drag.x)/r.width*view.w;view.y=drag.vy-(e.clientY-drag.y)/r.height*view.h;updateView()}else if(pts.size===2){let a=[...pts.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(lastDist>0){let mid={x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2},r=svg.getBoundingClientRect(),focus={x:(mid.x-r.left)/r.width*view.w+view.x,y:(mid.y-r.top)/r.height*view.h+view.y};zoom(d/lastDist,focus.x,focus.y)}lastDist=d}});
const end=e=>{pts.delete(e.pointerId);if(pts.size<2)lastDist=0;if(pts.size===1){let a=[...pts.values()][0];drag={x:a.x,y:a.y,vx:view.x,vy:view.y}}else drag=null};svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);svg.addEventListener('wheel',e=>{e.preventDefault();let p=toSvg(e);zoom(e.deltaY<0?1.18:1/1.18,p.x,p.y)},{passive:false});
$('zoomIn').onclick=()=>zoom(1.7);$('zoomOut').onclick=()=>zoom(1/1.7);$('resetView').onclick=()=>fit(b,30);$('confirmCountry').onclick=()=>{if(selectedCountry)toast('تم اختيار '+selectedCountry.ar+(selectedRegion?' — '+getName(selectedRegion):''))};
}
if(!geo||!geo.features){status('تعذّر قراءة بيانات الخريطة المضمّنة')}else init();
