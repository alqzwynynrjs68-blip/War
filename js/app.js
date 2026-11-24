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
let svg, baseGroup, adminGroup, urbanPlanGroup, countryBorderGroup;
let view = {x:0,y:0,w:1000,h:650};
let selectedCountry = null, selectedRegion = null;
let adminPaths = [], countryBorderPaths = [], cityMarkerNodes = [], cityMarkerLayer = null, overviewViewWidth = 222, overviewBounds = null;
let toastTimer = null;
let activePanel = null, diplomacyTab = 'countries', activeDiplomacyCountry = null;
let selectedCity = null, activeDialog = null, activeConversationCountry = null;
const relations = {};
const conversationMessages = {};
// Campaign state is initialized only when a country is selected and the world opens.
const STARTING_RESOURCES = Object.freeze({money:10000, iron:5000, electronics:5000});
let resources = {...STARTING_RESOURCES};
let gameStartedAt = null, gameClockTimer = null, gameMinute = 0;
let infantryResearch = {status:'available', completesAt:null};

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
  if(urbanPlanGroup) {
    const zoomLevel=overviewViewWidth>0?overviewViewWidth/view.w:1;
    urbanPlanGroup.style.visibility=zoomLevel>=2.2?'visible':'hidden';
  }
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
    path.setAttribute('stroke','#ffffff');
    path.setAttribute('stroke-width',active?'2.2':'1.9');
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
  selectedRegion=feature; selectedCity=null; paintAdminRegions();
  const city=CITY_MARKERS.find(item=>item.country===selectedCountry.ar && pointInFeature([item.lon,item.lat],feature));
  if(city) showCityPanel(city); else showRegionPanel(feature);
}
function pointInRing(point,ring) {
  const [x,y]=point; let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const [xi,yi]=ring[i], [xj,yj]=ring[j];
    if(((yi>y)!==(yj>y)) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}
function pointInFeature(point,feature) {
  const g=feature.geometry; if(!g) return false;
  const polygons=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
  return polygons.some(poly=>pointInRing(point,poly[0])&&!poly.slice(1).some(hole=>pointInRing(point,hole)));
}
function findCityRegion(city) {
  const country=allCountries.find(c=>c.ar===city.country);
  if(!country||!adminGeo||!Array.isArray(adminGeo.features)) return null;
  return adminGeo.features.find(f=>f.properties?.shapeGroup===country.id&&pointInFeature([city.lon,city.lat],f))||null;
}
function renderUrbanPlans() {
  if(!urbanPlanGroup) return;
  urbanPlanGroup.innerHTML='';
  const defs=addSvg('defs',{},urbanPlanGroup);
  const aspect=1076/741;
  CITY_MARKERS.forEach((city,index)=>{
    const feature=findCityRegion(city); if(!feature) return;
    const b=boundsForGeometry(feature.geometry);
    const width=Math.min(b.w*.84,b.h*.84*aspect),height=width/aspect;
    if(!(width>0&&height>0)) return;
    const [cx,cy]=project([city.lon,city.lat]);
    const clipId='urban-plan-clip-'+index;
    const clip=addSvg('clipPath',{id:clipId,clipPathUnits:'userSpaceOnUse'},defs);
    addSvg('path',{d:geometryPath(feature.geometry)},clip);
    const image=addSvg('image',{
      href:'assets/city-urban-plan.png',x:(cx-width/2).toFixed(4),y:(cy-height/2).toFixed(4),
      width:width.toFixed(4),height:height.toFixed(4),'preserveAspectRatio':'xMidYMid meet',
      'clip-path':`url(#${clipId})`,'pointer-events':'none',class:'urban-plan-image',
      'aria-hidden':'true'
    },urbanPlanGroup);
  });
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
// City miniatures use a screen-space HTML overlay, not SVG map units.
// This keeps their visible size absolutely constant regardless of map zoom.
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
const CITY_DOTS_ZOOM_LEVEL = 1.50; // تبدأ نقاط المدن عند 1.50x
const CITY_DOTS_HIDE_ZOOM_LEVEL = 2.40; // تختفي النقاط عند 2.40x
const CITY_DOT_SCREEN_SIZE = 5; // قطر النقطة بالبكسل
function renderCityMarkers() {
  if(!cityMarkerLayer) return;
  cityMarkerLayer.innerHTML=''; cityMarkerNodes=[];
  CITY_MARKERS.forEach(city=>{
    const [cx,cy]=project([city.lon,city.lat]);
    const dot=document.createElement('div');
    dot.setAttribute('aria-hidden','true');
    dot.title=city.name;
    dot.style.cssText='position:absolute;width:'+CITY_DOT_SCREEN_SIZE+'px;height:'+CITY_DOT_SCREEN_SIZE+'px;border-radius:50%;background:#ffd76a;border:1px solid #fff;box-shadow:0 0 4px rgba(255,215,106,.8);transform:translate(-50%,-50%);pointer-events:none;display:none;z-index:3;';
    cityMarkerLayer.appendChild(dot);
    cityMarkerNodes.push({dot,cx,cy});
  });
  updateCityMarkerSizes();
}
function updateCityMarkerSizes() {
  if(!svg||!cityMarkerLayer||!cityMarkerNodes.length) return;
  const rect=svg.getBoundingClientRect();
  if(!rect.width || !rect.height) return;
  const scale=Math.min(rect.width/view.w,rect.height/view.h);
  const offsetX=(rect.width-view.w*scale)/2;
  const offsetY=(rect.height-view.h*scale)/2;
  const zoomLevel=overviewViewWidth>0?overviewViewWidth/view.w:1;
  const showDots=zoomLevel>=CITY_DOTS_ZOOM_LEVEL && zoomLevel<CITY_DOTS_HIDE_ZOOM_LEVEL;
  cityMarkerNodes.forEach(({dot,cx,cy})=>{
    dot.style.left=(offsetX+(cx-view.x)*scale)+'px';
    dot.style.top=(offsetY+(cy-view.y)*scale)+'px';
    dot.style.display=showDots?'block':'none';
  });
}

function renderMap() {
  const map=$('map'); map.innerHTML='';
  svg=addSvg('svg',{viewBox:'0 0 1000 650',role:'img','aria-label':'خريطة الدول الثماني','preserveAspectRatio':'xMidYMid meet'},map);
  cityMarkerLayer=document.createElement('div');
  cityMarkerLayer.setAttribute('aria-label','نقاط مواقع المدن');
  cityMarkerLayer.style.cssText='position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:5;';
  map.appendChild(cityMarkerLayer);
  addSvg('rect',{x:0,y:0,width:1000,height:650,fill:'#091321'},svg);
  baseGroup=addSvg('g',{},svg);
  adminGroup=addSvg('g',{},svg);
  countryBorderGroup=addSvg('g',{'pointer-events':'none'},svg);
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
  urbanPlanGroup=addSvg('g',{'pointer-events':'none','aria-hidden':'true'},svg);
  renderUrbanPlans();
  countryBorderPaths=[];
  geo.features.forEach(feature=>{
    const id=feature.properties.iso_a3;
    if(!allCountries.some(c=>c.id===id)) return;
    const path=addSvg('path',{d:geometryPath(feature.geometry),fill:'none',stroke:'#ffffff','stroke-width':'1.9','stroke-opacity':'.98','vector-effect':'non-scaling-stroke'},countryBorderGroup);
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
  startNewCampaignClock();
  selectedRegion=null; closePanels();
  $('welcomeScreen').hidden=true; $('countryScreen').hidden=true; $('gameScreen').hidden=false;
  $('countryPopover').hidden=true; $('countryFlagButton').setAttribute('aria-expanded','false');
  updateCountryPopover();
  if(!svg) renderMap();
  else if(overviewBounds) fit(overviewBounds,30);
  paintCountries(); paintAdminRegions();
  requestAnimationFrame(()=>{if(svg)updateView();});
}
function returnToCountrySelection() {
  stopCampaignClock();
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

function showBottomPanel(id) {
  activePanel=id; selectedCity=null; selectedRegion=null;
  $('selectionPanel').hidden=true; $('dialogPanel').hidden=true;
  $('bottomNav').hidden=false;
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.panel===id));
  const panel=$('mainPanel'); panel.hidden=false;
  if(id==='diplomacy') renderDiplomacy();
  else if(id==='research') renderResearch();
  else { panel.innerHTML=''; panel.hidden=true; }
}
function closePanels() {
  activePanel=null; activeDialog=null;
  $('mainPanel').hidden=true; $('selectionPanel').hidden=true; $('dialogPanel').hidden=true;
  $('bottomNav').hidden=false;
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
}
function renderDiplomacy() {
  const panel=$('mainPanel'); panel.hidden=false;
  if(activeConversationCountry && diplomacyTab==='messages') { renderConversationThread(activeConversationCountry); return; }
  if(activeDiplomacyCountry) { renderCountryDiplomacy(activeDiplomacyCountry); return; }
  panel.innerHTML=`<div class="panel-head"><strong>الدبلوماسية</strong><button class="panel-close" data-close>×</button></div>
    <div class="panel-tabs"><button data-dtab="countries" class="${diplomacyTab==='countries'?'chosen':''}">الدول</button><button data-dtab="messages" class="${diplomacyTab==='messages'?'chosen':''}">المحادثات</button></div>
    <div class="panel-content" id="diplomacyContent"></div>`;
  panel.querySelector('[data-close]').onclick=closePanels;
  panel.querySelectorAll('[data-dtab]').forEach(b=>b.onclick=()=>{diplomacyTab=b.dataset.dtab;activeConversationCountry=null;activeDiplomacyCountry=null;renderDiplomacy();});
  const content=$('diplomacyContent');
  if(diplomacyTab==='countries') {
    content.innerHTML=allCountries.filter(c=>c.id!==selectedCountry.id).map(c=>`
      <button class="country-row" data-country="${c.id}">
        <span class="flag">${c.flag}</span><span class="country-row-name">${c.ar}</span>
        <span class="country-row-relation">${relations[c.id]||'سلام'}</span><span class="row-arrow">‹</span>
      </button>`).join('');
    content.querySelectorAll('[data-country]').forEach(b=>b.onclick=()=>{activeDiplomacyCountry=allCountries.find(c=>c.id===b.dataset.country);renderDiplomacy();});
  } else {
    const chats=allCountries.filter(c=>c.id!==selectedCountry.id && (conversationMessages[c.id]||[]).length);
    content.innerHTML=chats.length?chats.map(c=>`<button class="country-row conversation-row" data-chat-country="${c.id}"><span class="flag">${c.flag}</span><span class="country-row-name">${c.ar}</span><span class="row-arrow">‹</span></button>`).join(''):'<p class="empty-note">لا توجد محادثات حالياً</p>';
    content.querySelectorAll('[data-chat-country]').forEach(b=>b.onclick=()=>{activeConversationCountry=allCountries.find(c=>c.id===b.dataset.chatCountry);renderDiplomacy();});
  }
}
function renderCountryDiplomacy(country) {
  const relation=relations[country.id]||'سلام';
  const cities=CITY_MARKERS.filter(c=>c.country===country.ar).length;
  const provinces=adminGeo.features.filter(f=>f.properties.shapeGroup===country.id).length;
  $('mainPanel').innerHTML=`<div class="panel-head"><button class="back-small" id="diplomacyBack">‹</button><strong>${country.flag} ${country.ar}</strong><button class="panel-close" data-close>×</button></div>
  <div class="country-stats"><div><small>عدد المدن</small><b>${cities}</b></div><div><small>عدد المقاطعات</small><b>${provinces||country.count}</b></div></div>
  <div class="relation-line"><span>العلاقة الحالية</span><b>${relation}</b><button id="relationToggle" aria-label="تغيير العلاقة">⌄</button></div>
  <div id="relationOptions" class="relation-options relation-options-vertical" hidden>
    <button data-rel="سلام"><span>☮</span> السلام</button>
    <button data-rel="حرب"><span>⚔</span> الحرب</button>
    <button data-rel="تجارة"><span>⇄</span> التجارة</button>
    <button data-rel="مرور عسكري"><span>➜</span> مرور عسكري</button>
  </div>
  <div class="country-actions"><button id="locateCountry">⌖ الموقع</button><button id="openConversation">✉ المحادثة</button></div>`;
  $('diplomacyBack').onclick=()=>{activeDiplomacyCountry=null;renderDiplomacy();};
  $('mainPanel').querySelector('[data-close]').onclick=closePanels;
  $('relationToggle').onclick=()=>{$('relationOptions').hidden=!$('relationOptions').hidden;};
  $('relationOptions').querySelectorAll('[data-rel]').forEach(b=>b.onclick=()=>{relations[country.id]=b.dataset.rel;renderCountryDiplomacy(country);});
  $('locateCountry').onclick=()=>locateDiplomacyCountry(country);
  $('openConversation').onclick=()=>openConversation(country);
}
function locateDiplomacyCountry(country) {
  const f=geo.features.find(x=>x.properties.iso_a3===country.id);
  if(!f) return;
  fit(boundsForGeometry(f.geometry),18);
  const shape=baseGroup && baseGroup.querySelector(`[data-id="${country.id}"]`);
  if(shape) {
    shape.classList.remove('map-country-pulse');
    void shape.getBoundingClientRect();
    shape.classList.add('map-country-pulse');
    setTimeout(()=>shape.classList.remove('map-country-pulse'),3200);
  }
  showToast('تم تحديد موقع '+country.ar);
}
function openConversation(country) {
  activeDialog=null; activeConversationCountry=country; activeDiplomacyCountry=null;
  activePanel='diplomacy'; diplomacyTab='messages';
  $('dialogPanel').hidden=true; $('selectionPanel').hidden=true; $('bottomNav').hidden=false;
  $('mainPanel').hidden=false;
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.panel==='diplomacy'));
  renderDiplomacy();
}
function renderConversationThread(country) {
  const messages=conversationMessages[country.id]||[];
  $('mainPanel').innerHTML=`<div class="panel-head"><button class="back-small" id="chatBack">‹</button><strong>محادثة ${country.flag} ${country.ar}</strong><button class="panel-close" data-close>×</button></div>
    <div id="chatMessages" class="chat-messages thread-messages">${messages.map(m=>`<div class="chat-message">${escapeChatText(m)}</div>`).join('')}</div>
    <form id="chatForm" class="chat-form"><input id="chatInput" placeholder="اكتب رسالة..." autocomplete="off"><button>إرسال</button></form>`;
  $('chatBack').onclick=()=>{activeConversationCountry=null;renderDiplomacy();};
  $('mainPanel').querySelector('[data-close]').onclick=closePanels;
  $('chatForm').onsubmit=e=>{
    e.preventDefault(); const input=$('chatInput'), value=input.value.trim(); if(!value)return;
    if(!conversationMessages[country.id])conversationMessages[country.id]=[];
    conversationMessages[country.id].push(value); renderConversationThread(country);
    $('chatMessages').scrollTop=$('chatMessages').scrollHeight;
    $('chatInput').focus();
  };
  $('chatMessages').scrollTop=$('chatMessages').scrollHeight;
}
function escapeChatText(value) {
  return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function renderResearch() {
  $('mainPanel').innerHTML=`<div class="panel-head"><strong>الأبحاث</strong><button class="panel-close" data-close>×</button></div><div class="panel-content research-list"><button class="research-choice research-choice-banner" id="infantryChoice"><span class="research-art" aria-hidden="true"><span class="research-art-glow"></span><span class="research-art-soldier">🪖</span></span><span class="research-copy"><span class="research-icon">♜</span><b>المشاة</b><small>شجرة أبحاث قوات المشاة وتطوير قدراتها</small></span></button></div>`;
  $('mainPanel').querySelector('[data-close]').onclick=closePanels;
  $('infantryChoice').onclick=renderInfantryResearch;
}
const INFANTRY_RESEARCHES={
 infantry:{name:'جندي المشاة',icon:'🪖',day:1,cost:{money:1000,electronics:150,iron:250},description:'جندي مشاة يستطيع الدفاع عن الأراضي ومهاجمة الأعداء واحتلال الأراضي.'},
 health:{name:'زيادة صحة الجندي',icon:'✚',day:3,cost:{money:1250,electronics:188,iron:313},description:'تطوير قدرة جندي المشاة على تحمّل الضرر والبقاء في المعركة.'},
 power:{name:'زيادة قوة الجندي',icon:'⚔️',day:3,cost:{money:1250,electronics:188,iron:313},description:'تطوير القوة القتالية لجندي المشاة وزيادة قدرته الهجومية.'}
};
let infantryTech={infantry:'available',health:'locked',power:'locked'},selectedInfantryTech='infantry',activeInfantryTech=null,infantryTechCompletesAt=null,infantryTechStartedAt=null;
function currentGameDay(){return Math.floor(gameMinute/1440)+1;}
function techIsUnlocked(key){return key==='infantry'||(currentGameDay()>=INFANTRY_RESEARCHES[key].day&&infantryTech.infantry==='completed');}
function renderInfantryResearch(){
 const panel=$('dialogPanel'),selected=INFANTRY_RESEARCHES[selectedInfantryTech],state=infantryTech[selectedInfantryTech],cost=selected.cost,unlocked=techIsUnlocked(selectedInfantryTech),running=activeInfantryTech?INFANTRY_RESEARCHES[activeInfantryTech]:null,remaining=running?Math.max(0,infantryTechCompletesAt-gameMinute):0;
 panel.hidden=false;panel.classList.add('research-tree-screen');
 const status=state==='completed'?'مكتمل':state==='running'?'قيد البحث':!unlocked?'يفتح في اليوم '+selected.day:'متاح للبحث';
 const canStart=unlocked&&state==='available'&&!activeInfantryTech;
 panel.innerHTML=`<div class="research-tree-head"><div><small>مركز التطوير العسكري</small><strong>شجرة أبحاث المشاة</strong></div><button id="dialogClose" aria-label="إغلاق">×</button></div>
 <div class="research-top-cards">
 <section class="research-top-card active-research-card"><div class="research-card-label">البحث الجاري</div>${running?`<div class="research-running-unit"><span>${running.icon}</span><div><b>${running.name}</b><small id="researchActiveRemaining">الوقت المتبقي: ${remaining} دقيقة</small></div></div><div class="research-progress"><i id="researchActiveProgress" style="width:${Math.min(100,Math.max(0,(1-remaining)*100))}%"></i></div>`:'<div class="research-empty">لا يوجد بحث جارٍ حالياً</div>'}</section>
 <section class="research-top-card selected-research-card"><div class="research-card-label">البحث المحدد</div><div class="research-running-unit"><span>${selected.icon}</span><div><b>${selected.name}</b><small>${status}</small></div></div><div class="research-mini-costs">💵 ${cost.money.toLocaleString('en-US')}　📟 ${cost.electronics}　⚙️ ${cost.iron}</div><button id="startSelectedTech" class="start-research-button" ${canStart?'':'disabled'}>${state==='completed'?'مكتمل':state==='running'?'قيد البحث':!unlocked?'مقفل حتى اليوم '+selected.day:activeInfantryTech?'يوجد بحث جارٍ':'بحث'}</button></section></div>
 <div class="research-tree-subhead"><strong>تسلسل تطوير المشاة</strong><span>اليوم ${currentGameDay()}</span></div>
 <div class="research-tree-scroll"><div class="research-timeline">
 <div class="research-day-label">اليوم 1</div><div class="research-node-row"><button class="research-node ${selectedInfantryTech==='infantry'?'selected':''} ${infantryTech.infantry==='completed'?'completed':''}" data-tech="infantry"><span class="research-node-icon">🪖</span><b>جندي المشاة</b><small>${infantryTech.infantry==='completed'?'مكتمل':'البحث الأساسي'}</small></button></div>
 <div class="research-connector"></div><div class="research-day-label">اليوم 2</div><div class="research-day-empty">لا توجد أبحاث متاحة في هذا اليوم</div><div class="research-connector"></div>
 <div class="research-day-label">اليوم 3</div><div class="research-upgrade-branches"><button class="research-node upgrade-node ${selectedInfantryTech==='health'?'selected':''} ${infantryTech.health==='completed'?'completed':''} ${!techIsUnlocked('health')?'locked':''}" data-tech="health"><span class="research-node-icon">✚</span><b>زيادة الصحة</b><small>${infantryTech.health==='completed'?'مكتمل':techIsUnlocked('health')?'تطوير الجندي':'مقفل'}</small></button><button class="research-node upgrade-node ${selectedInfantryTech==='power'?'selected':''} ${infantryTech.power==='completed'?'completed':''} ${!techIsUnlocked('power')?'locked':''}" data-tech="power"><span class="research-node-icon">⚔️</span><b>زيادة القوة</b><small>${infantryTech.power==='completed'?'مكتمل':techIsUnlocked('power')?'تطوير الجندي':'مقفل'}</small></button></div></div></div>
 <div class="research-detail-strip"><div class="research-detail-title"><span>${selected.icon}</span><div><b>${selected.name}</b><small>${selected.description}</small></div></div><div class="research-detail-meta"><span>المتطلبات: 💵 ${cost.money.toLocaleString('en-US')}　📟 ${cost.electronics}　⚙️ ${cost.iron}</span><span>المدة: دقيقة واحدة</span></div></div>`;
 $('dialogClose').onclick=()=>{panel.hidden=true;panel.classList.remove('research-tree-screen');};
 panel.querySelectorAll('[data-tech]').forEach(btn=>btn.onclick=()=>{selectedInfantryTech=btn.dataset.tech;renderInfantryResearch();});
 $('startSelectedTech').onclick=()=>startInfantryTech(selectedInfantryTech);
}
function startInfantryTech(key){
 const tech=INFANTRY_RESEARCHES[key];if(!tech||!techIsUnlocked(key)||infantryTech[key]!=='available'||activeInfantryTech)return;
 const c=tech.cost;if(resources.money<c.money||resources.electronics<c.electronics||resources.iron<c.iron){showToast('الموارد غير كافية لإجراء البحث');return;}
 resources.money-=c.money;resources.electronics-=c.electronics;resources.iron-=c.iron;infantryTech[key]='running';activeInfantryTech=key;infantryTechCompletesAt=gameMinute+1;infantryTechStartedAt=Date.now();updateGameStatus();renderInfantryResearch();
}
function startNewCampaignClock() {
  stopCampaignClock();
  resources={...STARTING_RESOURCES};
  infantryResearch={status:'available',completesAt:null};
  infantryTech={infantry:'available',health:'locked',power:'locked'}; selectedInfantryTech='infantry'; activeInfantryTech=null; infantryTechCompletesAt=null; infantryTechStartedAt=null;
  gameStartedAt=Date.now(); gameMinute=0;
  updateGameStatus();
  gameClockTimer=window.setInterval(updateCampaignClock,1000);
}
function stopCampaignClock() {
  if(gameClockTimer!==null) window.clearInterval(gameClockTimer);
  gameClockTimer=null; gameStartedAt=null;
}
function updateCampaignClock() {
  if(gameStartedAt===null) return;
  // One in-game minute passes every five real seconds (one game hour = five real minutes).
  gameMinute=Math.floor((Date.now()-gameStartedAt)/5000);
  if(activeInfantryTech && gameMinute>=infantryTechCompletesAt) {
    const completed=activeInfantryTech; infantryTech[completed]='completed';
    if(completed==='infantry'){infantryTech.health='available';infantryTech.power='available';}
    activeInfantryTech=null; infantryTechCompletesAt=null; infantryTechStartedAt=null;
    if(!$('dialogPanel').hidden && $('dialogPanel').classList.contains('research-tree-screen')) renderInfantryResearch();
    showToast('اكتمل البحث: '+INFANTRY_RESEARCHES[completed].name);
  }
  if(activeInfantryTech){const label=$('researchActiveRemaining');const bar=$('researchActiveProgress');const progress=Math.min(100,Math.max(0,((Date.now()-infantryTechStartedAt)/5000)*100));if(label)label.textContent='مدة البحث: دقيقة واحدة';if(bar)bar.style.width=progress+'%';}
  updateGameStatus();
}
function updateGameStatus() {
  const day=Math.floor(gameMinute/1440)+1;
  const minuteOfDay=gameMinute%1440;
  const hours=String(Math.floor(minuteOfDay/60)).padStart(2,'0');
  const minutes=String(minuteOfDay%60).padStart(2,'0');
  const date=$('gameDateTime'); const money=$('moneyValue');
  if(date) date.textContent=`يوم ${day} | ${hours}:${minutes}`;
  if(money) money.textContent=resources.money.toLocaleString('en-US');
}
function showCityPanel(city) {
  selectedCity=city; activePanel=null;
  $('mainPanel').hidden=true; $('bottomNav').hidden=true; $('dialogPanel').hidden=true;
  $('selectionPanel').hidden=false;
  $('selectionPanel').innerHTML=`<div class="selection-city-head"><strong>🏙️ ${city.name}</strong><button class="panel-close" id="selectionClose">×</button></div><div class="happiness">😊 السعادة <b>75%</b></div><div class="selection-actions"><button id="cityBuild">🏗 بناء</button><button id="cityArmy">⚔ تصنيع جيش</button></div>`;
  $('selectionClose').onclick=closePanels;
  $('cityArmy').onclick=()=>showToast('تم فتح تصنيع الجيش للمدينة: '+city.name);
  $('cityBuild').onclick=()=>showToast('البناء في '+city.name);
}
function showRegionPanel(feature) {
  $('mainPanel').hidden=true; $('bottomNav').hidden=true; $('dialogPanel').hidden=true;
  $('selectionPanel').hidden=false;
  $('selectionPanel').innerHTML=`<div class="selection-city-head"><strong>🗺️ ${getRegionName(feature)}</strong><button class="panel-close" id="selectionClose">×</button></div><div class="selection-actions"><button id="regionBuild">🏗 بناء</button></div>`;
  $('selectionClose').onclick=closePanels;
  $('regionBuild').onclick=()=>showToast('البناء في '+getRegionName(feature));
}
function wireBottomNavigation() {
  document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>showBottomPanel(b.dataset.panel)));
}

function initInterface() {
  renderPlayableCountryCards();
  wireBottomNavigation();
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
