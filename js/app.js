/* WORLD DOMINION - Welcome, fixed playable-country selection, fullscreen strategy map */
const allCountries = [
  {id:'IRQ',en:'Iraq',ar:'العراق',flag:'🇮🇶',count:18,playable:true},
  {id:'SAU',en:'Saudi Arabia',ar:'السعودية',flag:'🇸🇦',count:13,playable:true},
  {id:'IRN',en:'Iran',ar:'إيران',flag:'🇮🇷',count:31,playable:true},
  {id:'KWT',en:'Kuwait',ar:'الكويت',flag:'🇰🇼',count:6},
  {id:'QAT',en:'Qatar',ar:'قطر',flag:'🇶🇦',count:8},
  {id:'BHR',en:'Bahrain',ar:'البحرين',flag:'🇧🇭',count:4},
  {id:'ARE',en:'United Arab Emirates',ar:'الإمارات',flag:'🇦🇪',count:7},
  {id:'OMN',en:'Oman',ar:'عُمان',flag:'🇴🇲',count:7}
];
const playableCountries = allCountries.filter(c=>c.playable);
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const geo = window.WD_COUNTRIES;
const adminGeo = window.WD_ADMIN_REGIONS;
let svg, baseGroup, adminGroup, countryBorderGroup;
let view = {x:0,y:0,w:1000,h:650};
let selectedCountry = null, selectedRegion = null;
let adminPaths = [], countryBorderPaths = [], cityMarkerNodes = [], cityMarkerGroup = null, overviewViewWidth = 222, overviewBounds = null;
let toastTimer = null;

function project([lon,lat]) { return [(lon+180)/360*1000,(90-lat)/180*650]; }
function ringsToPath(coords) {
  return coords.map(r=>r.map((pt,i)=>{const [x,y]=project(pt);return (i?'L':'M')+x.toFixed(2)+','+y.toFixed(2)}).join(' ')+' Z').join(' ');
}
function geometryPath(g) {
  if(!g) return '';
  if(g.type==='Polygon') return ringsToPath(g.coordinates);
  if(g.type==='MultiPolygon') return g.coordinates.map(ringsToPath).join(' ');
  return '';
}
function addSvg(tag,attrs,parent) {
  const e=document.createElementNS(NS,tag);
  Object.entries(attrs||{}).forEach(([k,v])=>e.setAttribute(k,v));
  parent.appendChild(e); return e;
}
function boundsForGeometry(g) {
  const pts=[];
  const scan=x=>{if(typeof x[0]==='number')pts.push(project(x));else x.forEach(scan)};
  scan(g.coordinates);
  const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
  return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
}
function unionBounds(items) {
  return {x:Math.min(...items.map(x=>x.x)),y:Math.min(...items.map(x=>x.y)),
    w:Math.max(...items.map(x=>x.x+x.w))-Math.min(...items.map(x=>x.x)),
    h:Math.max(...items.map(x=>x.y+x.h))-Math.min(...items.map(x=>x.y))};
}
function fit(b,pad=30) {
  const w=Math.max(30,b.w+pad*2),h=Math.max(30,b.h+pad*2),s=Math.min(1000/w,650/h);
  view={x:b.x-(1000-w*s)/2/s,y:b.y-(650-h*s)/2/s,w:1000/s,h:650/s};
  updateView();
}
function zoom(f,cx=view.x+view.w/2,cy=view.y+view.h/2) {
  const minW=.015,maxW=3000,nw=Math.min(maxW,Math.max(minW,view.w/f)),scale=nw/view.w,nh=view.h*scale;
  const rx=(cx-view.x)/view.w,ry=(cy-view.y)/view.h;
  view={x:cx-rx*nw,y:cy-ry*nh,w:nw,h:nh}; updateView();
}
function updateView() {
  if(!svg) return;
  svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
  updateCityMarkerSizes();
  // ADM1 lines are hidden at the full Gulf overview and fade in as the user zooms closer.
  const hideAt=overviewViewWidth*.985, fullAt=overviewViewWidth*.70;
  const t=Math.max(0,Math.min(1,(hideAt-view.w)/(hideAt-fullAt)));
  if(adminGroup) {
    adminGroup.style.opacity=String(t);
    adminGroup.style.visibility=t<.015?'hidden':'visible';
    adminGroup.style.display=t<.015?'none':'inline';
    adminGroup.style.pointerEvents=t>=.45?'auto':'none';
  }
}
function showToast(message) {
  const el=$('mapToast'); el.textContent=message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2600);
}
function getRegionName(f) {
  const p=f.properties||{};
  return p.shapeName||p.NAME_1||p.name_local||p.name_ar||p.name_en||p.name||p.admin||p.NAME||'منطقة';
}
function paintCountries() {
  baseGroup.querySelectorAll('path').forEach(p=>{
    const active=selectedCountry&&p.dataset.id===selectedCountry.id;
    p.setAttribute('fill',active?'#b99a62':'#18283b');
    p.setAttribute('fill-opacity',active?'1':'.78');
    p.setAttribute('stroke','none');
  });
  countryBorderPaths.forEach(({id,path})=>{
    const active=selectedCountry&&id===selectedCountry.id;
    path.setAttribute('stroke',active?'#e6c98f':'#8192a5');
    path.setAttribute('stroke-width',active?'4.6':'3.8');
    path.setAttribute('stroke-opacity',active?'1':'.92');
  });
}
function paintAdminRegions() {
  adminPaths.forEach(({feature,path})=>{
    const active=selectedRegion===feature;
    path.setAttribute('fill',active?'#e2bd75':'#76684f');
    path.setAttribute('fill-opacity',active?'.40':'.055');
    path.setAttribute('stroke',active?'#fff0c5':'#e0c795');
    path.setAttribute('stroke-width',active?'1.15':'.58');
    path.setAttribute('stroke-opacity',active?'1':'.88');
  });
}
function chooseRegion(feature) {
  const country=allCountries.find(c=>c.id===feature.properties.shapeGroup);
  if(!country || country.id!==selectedCountry.id) {
    showToast('هذه المنطقة تتبع دولة أخرى. للعب بها ارجع إلى قائمة الدول.'); return;
  }
  selectedRegion=feature; paintAdminRegions();
  showToast('تم تحديد '+getRegionName(feature));
}
function renderAdminRegions() {
  adminGroup.innerHTML=''; adminPaths=[];
  if(!adminGeo||!Array.isArray(adminGeo.features)) return;
  const allowed=new Set(allCountries.map(c=>c.id));
  adminGeo.features.forEach(feature=>{
    if(!feature.geometry||!feature.properties||!allowed.has(feature.properties.shapeGroup)) return;
    const path=addSvg('path',{
      d:geometryPath(feature.geometry),fill:'#76684f','fill-opacity':'.055',stroke:'#e0c795',
      'stroke-width':'.58','stroke-opacity':'.88','vector-effect':'non-scaling-stroke',class:'admin-shape'
    },adminGroup);
    path.addEventListener('click',e=>{e.stopPropagation();if(selectedCountry)chooseRegion(feature)});
    adminPaths.push({feature,path});
  });
}
// City miniatures are anchored to geographic coordinates. Their CSS-pixel size is
// recalculated after every zoom/pan so they remain the same visible size on screen.
const CITY_MARKERS = [
  {name:'مدينة الكويت',country:'الكويت',lon:47.9783,lat:29.3759},
  {name:'مسقط',country:'عُمان',lon:58.4059,lat:23.5880},
  {name:'المنامة',country:'البحرين',lon:50.5860,lat:26.2235},
  {name:'الدوحة',country:'قطر',lon:51.5310,lat:25.2854},
  {name:'بغداد',country:'العراق',lon:44.3661,lat:33.3152},
  {name:'النجف',country:'العراق',lon:44.0165,lat:32.0000},
  {name:'البصرة',country:'العراق',lon:47.7804,lat:30.5085},
  {name:'الرمادي',country:'العراق',lon:43.3000,lat:33.4200},
  {name:'الموصل',country:'العراق',lon:43.1300,lat:36.3400},
  {name:'السليمانية',country:'العراق',lon:45.4300,lat:35.5600},
  {name:'الكوت',country:'العراق',lon:45.8200,lat:32.5100},
  {name:'الرياض',country:'السعودية',lon:46.6753,lat:24.7136},
  {name:'طهران',country:'إيران',lon:51.3890,lat:35.6892}
];
const CITY_MARKER_SCREEN_SIZE = 34;
function renderCityMarkers() {
  if(!cityMarkerGroup) return;
  cityMarkerGroup.innerHTML=''; cityMarkerNodes=[];
  CITY_MARKERS.forEach(city=>{
    const [cx,cy]=project([city.lon,city.lat]);
    const image=addSvg('image',{x:cx,y:cy,width:1,height:1,href:'assets/city-model.png',
      preserveAspectRatio:'xMidYMax meet',class:'city-miniature','pointer-events':'none'},cityMarkerGroup);
    const title=addSvg('title',{},image); title.textContent=city.name+' — '+city.country;
    cityMarkerNodes.push({image,cx,cy});
  });
  updateCityMarkerSizes();
}
function updateCityMarkerSizes() {
  if(!svg||!cityMarkerNodes.length) return;
  const rect=svg.getBoundingClientRect();
  if(!rect.width) return;
  const size=CITY_MARKER_SCREEN_SIZE*view.w/rect.width;
  cityMarkerNodes.forEach(({image,cx,cy})=>{
    image.setAttribute('width',size);
    image.setAttribute('height',size);
    image.setAttribute('x',cx-size/2);
    image.setAttribute('y',cy-size);
  });
}

function renderMap() {
  const map=$('map'); map.innerHTML='';
  svg=addSvg('svg',{viewBox:'0 0 1000 650',role:'img','aria-label':'خريطة الدول الثماني','preserveAspectRatio':'xMidYMid meet'},map);
  addSvg('rect',{x:0,y:0,width:1000,height:650,fill:'#091321'},svg);
  baseGroup=addSvg('g',{},svg);
  adminGroup=addSvg('g',{},svg);
  countryBorderGroup=addSvg('g',{'pointer-events':'none'},svg);
  cityMarkerGroup=addSvg('g',{'pointer-events':'none','aria-label':'مجسمات المدن'},svg);
  geo.features.forEach(feature=>{
    const id=feature.properties.iso_a3;
    if(!allCountries.some(c=>c.id===id)) return;
    const path=addSvg('path',{d:geometryPath(feature.geometry),fill:'#18283b','fill-opacity':'.78',stroke:'none',class:'country-shape','data-id':id},baseGroup);
    path.addEventListener('click',()=>{
      if(!selectedCountry) return;
      if(id!==selectedCountry.id) showToast('لا يمكنك تغيير دولتك أثناء اللعب. استخدم زر الرجوع.');
    });
  });
  renderAdminRegions();
  countryBorderPaths=[];
  geo.features.forEach(feature=>{
    const id=feature.properties.iso_a3;
    if(!allCountries.some(c=>c.id===id)) return;
    const path=addSvg('path',{d:geometryPath(feature.geometry),fill:'none',stroke:'#8192a5','stroke-width':'3.8','stroke-opacity':'.98','vector-effect':'non-scaling-stroke'},countryBorderGroup);
    countryBorderPaths.push({id,path});
  });
  const allBounds=geo.features.filter(f=>allCountries.some(c=>c.id===f.properties.iso_a3)).map(f=>boundsForGeometry(f.geometry));
  overviewBounds=unionBounds(allBounds); fit(overviewBounds,30); overviewViewWidth=view.w;
  paintCountries(); paintAdminRegions();
  renderCityMarkers(); updateView();
  window.addEventListener('resize',updateCityMarkerSizes);

  let pointers=new Map(),drag=null,lastDistance=0,moved=false;
  const toSvg=e=>{const r=svg.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*view.w+view.x,y:(e.clientY-r.top)/r.height*view.h+view.y};};
  svg.addEventListener('pointerdown',e=>{
    svg.setPointerCapture(e.pointerId); pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}); moved=false;
    if(pointers.size===1) drag={x:e.clientX,y:e.clientY,vx:view.x,vy:view.y};
    if(pointers.size===2){const a=[...pointers.values()];lastDistance=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);drag=null;}
  });
  svg.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===1&&drag){
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(Math.abs(dx)+Math.abs(dy)>4)moved=true;
      const r=svg.getBoundingClientRect();
      view.x=drag.vx-dx/r.width*view.w; view.y=drag.vy-dy/r.height*view.h; updateView();
    } else if(pointers.size===2){
      const a=[...pointers.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
      if(lastDistance>0){
        const mid={x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2},r=svg.getBoundingClientRect();
        const focus={x:(mid.x-r.left)/r.width*view.w+view.x,y:(mid.y-r.top)/r.height*view.h+view.y};
        zoom(d/lastDistance,focus.x,focus.y);
      }
      lastDistance=d;
    }
  });
  const end=e=>{pointers.delete(e.pointerId);if(pointers.size<2)lastDistance=0;if(pointers.size===1){const p=[...pointers.values()][0];drag={x:p.x,y:p.y,vx:view.x,vy:view.y};}else drag=null;};
  svg.addEventListener('pointerup',end); svg.addEventListener('pointercancel',end);
  svg.addEventListener('wheel',e=>{e.preventDefault();const p=toSvg(e);zoom(e.deltaY<0?1.18:1/1.18,p.x,p.y);},{passive:false});
  $('zoomIn').onclick=()=>zoom(1.65);
  $('zoomOut').onclick=()=>zoom(1/1.65);
  $('resetView').onclick=()=>fit(overviewBounds,30);
}
function updateCountryPopover() {
  $('topCountryFlag').textContent=selectedCountry.flag;
  $('popoverFlag').textContent=selectedCountry.flag;
  $('popoverCountryName').textContent=selectedCountry.ar;
  $('popoverRegionCount').textContent=selectedCountry.count;
}
function enterGame(countryId) {
  selectedCountry=playableCountries.find(c=>c.id===countryId);
  if(!selectedCountry) return;
  selectedRegion=null;
  $('welcomeScreen').hidden=true; $('countryScreen').hidden=true; $('gameScreen').hidden=false;
  $('countryPopover').hidden=true; $('countryFlagButton').setAttribute('aria-expanded','false');
  updateCountryPopover();
  if(!svg) renderMap();
  else if(overviewBounds) fit(overviewBounds,30);
  paintCountries(); paintAdminRegions();
  requestAnimationFrame(()=>{if(svg)updateView();});
}
function returnToCountrySelection() {
  selectedCountry=null; selectedRegion=null;
  $('countryPopover').hidden=true; $('countryFlagButton').setAttribute('aria-expanded','false');
  $('gameScreen').hidden=true; $('welcomeScreen').hidden=true; $('countryScreen').hidden=false;
  paintCountries(); paintAdminRegions();
}
function renderPlayableCountryCards() {
  const root=$('playableCountries'); root.innerHTML='';
  playableCountries.forEach(country=>{
    const button=document.createElement('button'); button.type='button'; button.className='play-country-card';
    button.innerHTML=`<span class="play-country-flag">${country.flag}</span><span class="play-country-name">${country.ar}</span><span class="play-country-meta">${country.count} مقاطعة</span><span class="play-country-arrow">←</span>`;
    button.addEventListener('click',()=>enterGame(country.id)); root.appendChild(button);
  });
}
function initInterface() {
  renderPlayableCountryCards();
  $('startButton').addEventListener('click',()=>{$('welcomeScreen').hidden=true;$('countryScreen').hidden=false;});
  $('selectionBackButton').addEventListener('click',()=>{$('countryScreen').hidden=true;$('welcomeScreen').hidden=false;});
  $('backToCountries').addEventListener('click',returnToCountrySelection);
  $('countryFlagButton').addEventListener('click',()=>{
    const pop=$('countryPopover'); pop.hidden=!pop.hidden;
    $('countryFlagButton').setAttribute('aria-expanded',String(!pop.hidden));
  });
  document.addEventListener('pointerdown',e=>{
    if(!$('countryPopover').hidden&&!$('countryPopover').contains(e.target)&&!$('countryFlagButton').contains(e.target)){
      $('countryPopover').hidden=true;$('countryFlagButton').setAttribute('aria-expanded','false');
    }
  });
}
if(!geo||!Array.isArray(geo.features)||!adminGeo||!Array.isArray(adminGeo.features)) {
  console.error('WORLD DOMINION: map/admin data files are missing or invalid.');
  $('startButton').addEventListener('click',()=>showToast('تعذّر تحميل بيانات الخريطة. تأكد من وجود ملفات البيانات الأصلية.'));
} else {
  initInterface();
}
