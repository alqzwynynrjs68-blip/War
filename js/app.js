/* WORLD DOMINION - Welcome, fixed playable-country selection, fullscreen strategy map */
function flagFromIso2(code) {
  if(!code || code.length!==2) return '🌐';
  return String.fromCodePoint(...[...code.toUpperCase()].map(ch=>127397+ch.charCodeAt(0)));
}
const regionNamesArabic = typeof Intl!=='undefined' && Intl.DisplayNames ? new Intl.DisplayNames(['ar'],{type:'region'}) : null;
const allCountries = (window.WD_COUNTRY_LIST||[]).map(p=>{
  const ar=p.ar || (p.iso2 && regionNamesArabic ? regionNamesArabic.of(p.iso2) : p.en);
  return {id:p.id,en:p.en||p.id,ar:ar||p.en||p.id,flag:flagFromIso2(p.iso2),iso2:p.iso2,count:p.count||0,playable:true};
}).sort((a,b)=>a.id==='IRQ'?-1:b.id==='IRQ'?1:a.ar.localeCompare(b.ar,'ar'));
const playableCountries = allCountries;
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
let geo = window.WD_COUNTRIES || null;
let adminGeo = window.WD_ADMIN_REGIONS || null;
let worldDataLoadPromise = null;
let svg, baseGroup, adminGroup, urbanPlanGroup, countryBorderGroup;
let view = {x:0,y:0,w:1000,h:650};
let selectedCountry = null, selectedRegion = null;
let adminPaths = [], countryBorderPaths = [], wrapCopies = [], cityMarkerNodes = [], cityMarkerLayer = null, overviewViewWidth = 222, overviewBounds = null;
let worldWrapEnabled = true;
try { worldWrapEnabled = localStorage.getItem('wd-world-wrap') !== 'off'; } catch (_) {}
let toastTimer = null;
let viewRenderFrame = 0, lastStyledZoom = null, lastStyledCountry = null;
let activePanel = null, diplomacyTab = 'countries', activeDiplomacyCountry = null;
let selectedCity = null, activeDialog = null, activeConversationCountry = null;
const relations = {};
const conversationMessages = {};
// Campaign state is initialized only when a country is selected and the world opens.
const RESOURCE_DEFS = {
  money:{icon:'💵',name:'الدولارات',stock:10000,consumption:35}, food:{icon:'🌾',name:'الغذاء',stock:1800,consumption:55}, oil:{icon:'🛢️',name:'النفط',stock:1400,consumption:28}, workforce:{icon:'👷',name:'القوى العاملة',stock:900,consumption:8},
  supplies:{icon:'📦',name:'الإمدادات',stock:900,consumption:22}, iron:{icon:'🔩',name:'الحديد',stock:1200,consumption:18}, rubber:{icon:'⚫',name:'المطاط',stock:700,consumption:10}, electronics:{icon:'💻',name:'الإلكترونيات',stock:800,consumption:9}, rare:{icon:'💎',name:'القطع النادرة',stock:250,consumption:3}
};
const CITY_PRODUCTION = {
  'بغداد':{key:'supplies',amount:90,money:55,workforce:28},'النجف':{key:'food',amount:75,money:32,workforce:24},'البصرة':{key:'oil',amount:110,money:68,workforce:30},'الرمادي':{key:'rubber',amount:35,money:24,workforce:18},'الموصل':{key:'iron',amount:65,money:42,workforce:26},'السليمانية':{key:'electronics',amount:28,money:38,workforce:20},'الكوت':{key:'workforce',amount:45,money:22,workforce:18},
  'الرياض':{key:'money',amount:95,money:95,workforce:34},'طهران':{key:'electronics',amount:55,money:72,workforce:38},'مدينة الكويت':{key:'oil',amount:55,money:48,workforce:16},'مسقط':{key:'supplies',amount:35,money:30,workforce:17},'المنامة':{key:'money',amount:40,money:40,workforce:14},'الدوحة':{key:'rare',amount:12,money:58,workforce:19}
};
let resources = Object.fromEntries(Object.entries(RESOURCE_DEFS).map(([key,def])=>[key,def.stock]));
let resourceProduction = {}, resourceConsumption = {};
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
// Country outlines should trace only each polygon's exterior coastline/border.
// Interior rings are holes (often lakes or data artifacts) and must not be
// drawn as country-separating lines at world scale. Keep every island polygon.
function countryOutlinePath(g) {
  if(!g) return '';
  if(g.type==='Polygon') return ringsToPath(g.coordinates.length?[g.coordinates[0]]:[]);
  if(g.type==='MultiPolygon') return g.coordinates.map(poly=>ringsToPath(poly.length?[poly[0]]:[])).join(' ');
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
  constrainCamera();
  updateView();
}
function constrainCamera() {
  // With wrapping enabled, longitude loops continuously. When disabled, clamp
  // the camera to the single world copy and avoid rendering duplicate worlds.
  if(worldWrapEnabled) view.x=((view.x%1000)+1000)%1000;
  else view.x=Math.max(0,Math.min(Math.max(0,1000-view.w),view.x));
  const verticalMargin=6.0;
  const minY=verticalMargin;
  const maxY=650-view.h-verticalMargin;
  // If the viewport is taller than the usable map area, center it instead of allowing overscroll.
  view.y=maxY<minY?(650-view.h)/2:Math.max(minY,Math.min(maxY,view.y));
}
function scheduleViewUpdate() {
  if(viewRenderFrame) return;
  viewRenderFrame=requestAnimationFrame(()=>{viewRenderFrame=0;updateView();});
}
function zoom(f,cx=view.x+view.w/2,cy=view.y+view.h/2,defer=false) {
  const minW=overviewViewWidth/75.0,maxW=overviewViewWidth/5.0,nw=Math.min(maxW,Math.max(minW,view.w/f)),scale=nw/view.w,nh=view.h*scale;
  const rx=(cx-view.x)/view.w,ry=(cy-view.y)/view.h;
  view={x:cx-rx*nw,y:cy-ry*nh,w:nw,h:nh}; constrainCamera();
  if(defer) scheduleViewUpdate(); else updateView();
}
function updateView() {
  if(!svg) return;
  svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
  updateCityMarkerSizes();
  if(urbanPlanGroup) {
    const zoomLevel=overviewViewWidth>0?overviewViewWidth/view.w:1;
    urbanPlanGroup.style.visibility=zoomLevel>=14.5?'visible':'hidden';
  }
  // Zoom-dependent SVG styling is unchanged while panning; recalculate it only
  // when zoom or the selected country actually changes.
  const zoomLevel=overviewViewWidth>0?overviewViewWidth/view.w:1;
  const zoomKey=zoomLevel.toFixed(4), countryKey=selectedCountry?selectedCountry.id:'';
  if(zoomKey!==lastStyledZoom || countryKey!==lastStyledCountry) {
    const borderT=Math.max(0,Math.min(1,(zoomLevel-1)/2.5));
    const easedBorderT=borderT*borderT*(3-2*borderT);
    countryBorderPaths.forEach(({id,path})=>{
      const active=selectedCountry&&id===selectedCountry.id;
      const width=active?(0.34+0.66*easedBorderT):(0.16+0.54*easedBorderT);
      const opacity=active?(0.62+0.36*easedBorderT):(0.30+0.52*easedBorderT);
      path.setAttribute('stroke-width',width.toFixed(3));
      path.setAttribute('stroke-opacity',opacity.toFixed(3));
    });
    if(urbanPlanGroup) urbanPlanGroup.style.visibility=zoomLevel>=14.5?'visible':'hidden';
    const t=zoomLevel>=65.0?1:0;
    wrapCopies.forEach(copy=>{
      if(copy.index===1){
        copy.left.style.opacity=String(t); copy.right.style.opacity=String(t);
        copy.left.style.display=t<.015?'none':'inline'; copy.right.style.display=t<.015?'none':'inline';
      }
    });
    if(adminGroup) {
      adminGroup.style.opacity=String(t);
      adminGroup.style.visibility=t<.015?'hidden':'visible';
      adminGroup.style.display=t<.015?'none':'inline';
      adminGroup.style.pointerEvents=t>=.45?'auto':'none';
    }
    lastStyledZoom=zoomKey; lastStyledCountry=countryKey;
  }
}
function showToast(message) {
  const el=$('mapToast'); el.textContent=message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2600);
}
const ARABIC_REGION_NAMES={
  'Baghdad':'بغداد','Basra':'البصرة','Al Basrah':'البصرة','Anbar':'الأنبار','Al Anbar':'الأنبار','Nineveh':'نينوى','Ninawa':'نينوى','Mosul':'الموصل','Erbil':'أربيل','Arbil':'أربيل','Sulaymaniyah':'السليمانية','As Sulaymaniyah':'السليمانية','Dohuk':'دهوك','Diyala':'ديالى','Wasit':'واسط','Kut':'الكوت','Maysan':'ميسان','Amarah':'العمارة','Dhi Qar':'ذي قار','Nasiriyah':'الناصرية','Najaf':'النجف','Karbala':'كربلاء','Qadisiyah':'القادسية','Al Qadisiyah':'القادسية','Babil':'بابل','Babylon':'بابل','Kirkuk':'كركوك','Saladin':'صلاح الدين','Salah ad Din':'صلاح الدين','Al Muthanna':'المثنى','Muthanna':'المثنى',
  'Tehran':'طهران','Khuzestan':'خوزستان','Ilam':'إيلام','Kermanshah':'كرمانشاه','Kurdistan':'كردستان','West Azerbaijan':'أذربيجان الغربية','East Azerbaijan':'أذربيجان الشرقية','Fars':'فارس','Hormozgan':'هرمزغان','Bushehr':'بوشهر','Kuwait':'الكويت','Al Ahmadi':'الأحمدي','Hawalli':'حولي','Jahra':'الجهراء','Capital':'العاصمة'
};
function transliterateRegionName(value) {
  const raw=String(value||'').trim();
  if(!raw) return 'منطقة';
  if(/[\u0600-\u06FF]/.test(raw)) return raw;
  if(ARABIC_REGION_NAMES[raw]) return ARABIC_REGION_NAMES[raw];
  const words=raw.replace(/[_-]+/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').split(/\s+/);
  const map={a:'ا',b:'ب',c:'ك',d:'د',e:'ي',f:'ف',g:'غ',h:'ه',i:'ي',j:'ج',k:'ك',l:'ل',m:'م',n:'ن',o:'و',p:'ب',q:'ق',r:'ر',s:'س',t:'ت',u:'و',v:'ف',w:'و',x:'كس',y:'ي',z:'ز'};
  return words.map(word=>{const lower=word.toLowerCase(); if(ARABIC_REGION_NAMES[word])return ARABIC_REGION_NAMES[word]; return [...lower].map(ch=>map[ch]||'').join('');}).join(' ');
}
function getRegionName(f) {
  const p=f.properties||{};
  const source=p.name_ar||p.name_local||p.shapeName||p.NAME_1||p.name_en||p.name||p.admin||p.NAME||'منطقة';
  return transliterateRegionName(source);
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
    path.setAttribute('stroke',active?'#fff0c5':'#cbd5e1');
    // Stroke styling is updated continuously from updateView() so borders stay subtle
    // at world scale and become clearer only as the camera zooms in.
    path.setAttribute('stroke-width',active?'1.1':'.55');
    path.setAttribute('stroke-opacity',active?'.98':'.62');
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
  if(!country) return;
  selectedRegion=feature; selectedCity=null; paintAdminRegions();
  // Provinces in every country can be inspected. Only the player's own
  // country keeps the existing city/building interactions.
  if(country.id!==selectedCountry.id) { showForeignRegionPopover(feature,country); return; }
  const city=CITY_MARKERS.find(item=>(item.countryId===selectedCountry.id || item.country===selectedCountry.ar) && pointInFeature([item.lon,item.lat],feature));
  if(city) showCityPanel(city); else showRegionPanel(feature);
}
function showForeignRegionPopover(feature,country) {
  const panel=$('selectionPanel');
  $('mainPanel').hidden=true; $('bottomNav').hidden=true; $('dialogPanel').hidden=true;
  panel.hidden=false;
  panel.innerHTML=`<div class="selection-city-head"><strong>🗺️ ${getRegionName(feature)}</strong><button class="panel-close" id="selectionClose" aria-label="إغلاق">×</button></div>`;
  panel.style.cssText='position:fixed;left:50%;bottom:105px;transform:translateX(-50%);z-index:30;width:max-content;min-width:190px;max-width:80vw;padding:12px 16px;border:1px solid #c49a4a;border-radius:12px;background:#101d2d;color:#f5e7c8;box-shadow:0 8px 28px rgba(0,0,0,.45);';
  $('selectionClose').onclick=closePanels;
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
  const country=allCountries.find(c=>c.id===city.countryId || c.ar===city.country);
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
const IRAQ_CITY_MARKERS = [
  {name:'بغداد',country:'العراق',countryId:'IRQ',lon:44.3661,lat:33.3152},
  {name:'النجف',country:'العراق',countryId:'IRQ',lon:44.0165,lat:32.0000},
  {name:'البصرة',country:'العراق',countryId:'IRQ',lon:47.7804,lat:30.5085},
  {name:'الرمادي',country:'العراق',countryId:'IRQ',lon:43.3000,lat:33.4200},
  {name:'الموصل',country:'العراق',countryId:'IRQ',lon:43.1300,lat:36.3400},
  {name:'السليمانية',country:'العراق',countryId:'IRQ',lon:45.4300,lat:35.5600},
  {name:'الكوت',country:'العراق',countryId:'IRQ',lon:45.8200,lat:32.5100}
];
function buildWorldCapitalMarkers() {
  return (window.WD_CAPITALS||[]).filter(c=>c.country!=='IRQ').map(c=>{
    const country=allCountries.find(x=>x.id===c.country);
    return {name:c.name,country:country?.ar||country?.en||c.country,countryId:c.country,lon:c.lon,lat:c.lat,isCapital:true};
  });
}
let CITY_MARKERS = [...IRAQ_CITY_MARKERS];
const CITY_DOTS_ZOOM_LEVEL = 8.0; // تبدأ نقاط المدن عند 8.0x
const CITY_MODELS_ZOOM_LEVEL = 14.5; // تختفي نقاط المدن عند 14.5x ويظهر مخطط المدينة
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
  const showDots=zoomLevel>=CITY_DOTS_ZOOM_LEVEL && zoomLevel<CITY_MODELS_ZOOM_LEVEL;
  cityMarkerNodes.forEach(({dot,cx,cy})=>{
    const wrappedCx=worldWrapEnabled?cx+Math.round((view.x+view.w/2-cx)/1000)*1000:cx;
    const left=(offsetX+(wrappedCx-view.x)*scale)+'px';
    const top=(offsetY+(cy-view.y)*scale)+'px';
    dot.style.left=left;
    dot.style.top=top;
    dot.style.display=showDots?'block':'none';
  });
}

function createWorldWrapCopies() {
  if(!svg || wrapCopies.length) return;
  [baseGroup,adminGroup,countryBorderGroup,urbanPlanGroup].forEach((group,index)=>{
    const left=group.cloneNode(true),right=group.cloneNode(true);
    left.setAttribute('transform','translate(-1000 0)');
    right.setAttribute('transform','translate(1000 0)');
    [left,right].forEach(copy=>{
      copy.querySelectorAll('.admin-shape').forEach((path,i)=>path.addEventListener('click',e=>{e.stopPropagation();if(selectedCountry&&adminPaths[i])chooseRegion(adminPaths[i].feature);}));
      copy.querySelectorAll('.country-shape').forEach(path=>path.addEventListener('click',()=>{if(selectedCountry&&path.getAttribute('data-id')!==selectedCountry.id)showToast('لا يمكنك تغيير دولتك أثناء اللعب. استخدم زر الرجوع.');}));
    });
    svg.appendChild(left); svg.appendChild(right);
    wrapCopies.push({index,left,right});
  });
}
function setWorldWrapEnabled(enabled) {
  worldWrapEnabled=!!enabled;
  try { localStorage.setItem('wd-world-wrap',worldWrapEnabled?'on':'off'); } catch (_) {}
  if(worldWrapEnabled) createWorldWrapCopies();
  else {
    wrapCopies.forEach(copy=>{copy.left.remove();copy.right.remove();});
    wrapCopies=[];
  }
  constrainCamera();
  updateView();
  updateWorldWrapButton();
  showToast(worldWrapEnabled?'تم تشغيل الانتقال المستمر للخريطة':'تم إيقاف الانتقال المستمر لتخفيف حمل الرسم');
}
function updateWorldWrapButton() {
  const button=$('worldWrapToggle');
  if(!button) return;
  button.setAttribute('aria-pressed',String(worldWrapEnabled));
  button.innerHTML=`<span aria-hidden="true">↔</span><b>الالتفاف ${worldWrapEnabled?'مفعّل':'متوقف'}</b>`;
  button.classList.toggle('is-off',!worldWrapEnabled);
}
function installWorldWrapButton() {
  const map=$('map');
  if(!map || $('worldWrapToggle')) return;
  const button=document.createElement('button');
  button.id='worldWrapToggle'; button.type='button'; button.className='world-wrap-toggle';
  button.addEventListener('click',()=>setWorldWrapEnabled(!worldWrapEnabled));
  map.appendChild(button); updateWorldWrapButton();
}

function renderMap() {
  const map=$('map'); map.innerHTML='';
  svg=addSvg('svg',{viewBox:'0 0 1000 650',role:'img','aria-label':'خريطة العالم','preserveAspectRatio':'xMidYMid meet'},map);
  cityMarkerLayer=document.createElement('div');
  cityMarkerLayer.setAttribute('aria-label','علامات مواقع المدن');
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
    const path=addSvg('path',{d:countryOutlinePath(feature.geometry),fill:'none',stroke:'#ffffff','stroke-width':'.55','stroke-opacity':'.62','vector-effect':'non-scaling-stroke'},countryBorderGroup);
    countryBorderPaths.push({id,path});
  });
  // Duplicate the complete world only while horizontal wrapping is enabled.
  // Disabling it removes these SVG copies entirely to reduce drawing work.
  wrapCopies=[];
  if(worldWrapEnabled) createWorldWrapCopies();
  const allBounds=geo.features.filter(f=>allCountries.some(c=>c.id===f.properties.iso_a3)).map(f=>boundsForGeometry(f.geometry));
  overviewBounds=unionBounds(allBounds); fit(overviewBounds,30); overviewViewWidth=view.w;
  paintCountries(); paintAdminRegions();
  renderCityMarkers(); zoom(3.0);
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
      view.x=drag.vx-dx/r.width*view.w; view.y=drag.vy-dy/r.height*view.h; constrainCamera(); scheduleViewUpdate();
    } else if(pointers.size===2){
      const a=[...pointers.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
      if(lastDistance>0){
        const mid={x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2},r=svg.getBoundingClientRect();
        const focus={x:(mid.x-r.left)/r.width*view.w+view.x,y:(mid.y-r.top)/r.height*view.h+view.y};
        zoom(d/lastDistance,focus.x,focus.y,true);
      }
      lastDistance=d;
    }
  });
  const end=e=>{pointers.delete(e.pointerId);if(pointers.size<2)lastDistance=0;if(pointers.size===1){const p=[...pointers.values()][0];drag={x:p.x,y:p.y,vx:view.x,vy:view.y};}else drag=null;};
  svg.addEventListener('pointerup',end); svg.addEventListener('pointercancel',end);
  svg.addEventListener('wheel',e=>{e.preventDefault();const p=toSvg(e);zoom(e.deltaY<0?1.18:1/1.18,p.x,p.y);},{passive:false});

}
function updateCountryPopover() {
  $('topCountryFlag').textContent=selectedCountry.flag;
  $('popoverFlag').textContent=selectedCountry.flag;
  $('popoverCountryName').textContent=selectedCountry.ar;
  $('popoverCityCount').textContent=CITY_MARKERS.filter(city=>city.countryId===selectedCountry.id || city.country===selectedCountry.ar).length;
}
function loadWorldData() {
  if(geo && adminGeo && window.WD_CAPITALS) return Promise.resolve();
  if(worldDataLoadPromise) return worldDataLoadPromise;
  const loadScript=src=>new Promise((resolve,reject)=>{
    const script=document.createElement('script'); script.src=src;
    script.onload=resolve; script.onerror=()=>reject(new Error('تعذر تحميل '+src));
    document.head.appendChild(script);
  });
  worldDataLoadPromise=Promise.all([
    loadScript('js/map-data.js'),loadScript('js/admin-data.js'),loadScript('js/capital-data.js')
  ]).then(()=>{
    geo=window.WD_COUNTRIES; adminGeo=window.WD_ADMIN_REGIONS;
    CITY_MARKERS=[...IRAQ_CITY_MARKERS,...buildWorldCapitalMarkers()];
    if(!geo||!Array.isArray(geo.features)||!adminGeo||!Array.isArray(adminGeo.features)||!Array.isArray(window.WD_CAPITALS))
      throw new Error('بيانات خريطة العالم غير مكتملة');
  }).catch(error=>{worldDataLoadPromise=null;throw error;});
  return worldDataLoadPromise;
}

async function enterGame(countryId) {
  const country=playableCountries.find(c=>c.id===countryId);
  if(!country) return;
  const cards=$('playableCountries').querySelectorAll('button'); cards.forEach(b=>b.disabled=true);
  const loading=$('countryLoading'); if(loading){loading.hidden=false;loading.textContent='جاري تحميل خريطة العالم…';}
  try { await loadWorldData(); }
  catch(error) { cards.forEach(b=>b.disabled=false); if(loading){loading.hidden=false;loading.textContent='تعذر تحميل الخريطة. تحقق من ملفات اللعبة ثم أعد المحاولة.';} console.error(error); return; }
  if(loading) loading.hidden=true;
  selectedCountry=country;
  startNewCampaignClock();
  selectedRegion=null; closePanels();
  $('welcomeScreen').hidden=true; $('countryScreen').hidden=true; $('gameScreen').hidden=false;
  $('countryPopover').hidden=true; $('countryFlagButton').setAttribute('aria-expanded','false');
  updateCountryPopover();
  if(!svg) renderMap();
  else if(overviewBounds) { fit(overviewBounds,30); zoom(3.0); }
  installWorldWrapButton();
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
  const panel=$('mainPanel'); panel.hidden=false; panel.classList.remove('cities-panel');
  if(id==='diplomacy') renderDiplomacy();
  else if(id==='research') renderResearch();
  else if(id==='cities') renderCities();
  else { panel.classList.remove('cities-panel'); panel.innerHTML=''; panel.hidden=true; }
}
function closePanels() {
  $('selectionPanel').style.cssText='';
  activePanel=null; activeDialog=null;
  $('mainPanel').hidden=true; $('mainPanel').classList.remove('research-fullscreen','infantry-tree-screen'); $('selectionPanel').hidden=true; $('dialogPanel').hidden=true;
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
const RESEARCH_CATEGORIES=[
  {id:'infantry',name:'المشاة',image:'infantry-banner.jpg',icon:'infantry-icon.png'},
  {id:'armor',name:'الدبابات',image:'armor-banner.jpg',icon:'armor-icon.png'},
  {id:'support',name:'الدعم',image:'support-banner.jpg',icon:'support-icon.png'},
  {id:'helicopter',name:'الهليكوبتر',image:'helicopter-banner.jpg',icon:'helicopter-icon.png'},
  {id:'fighters',name:'الطائرات',image:'fighters-banner.jpg',icon:'fighters-icon.png'},
  {id:'strategic-aircraft',name:'الطائرات الاستراتيجية',image:'strategic-aircraft-banner.jpg',icon:'strategic-aircraft-icon.png'},
  {id:'naval',name:'السفن البحرية',image:'naval-banner.jpg',icon:'naval-icon.png'},
  {id:'submarines',name:'الغواصات',image:'submarines-banner.jpg',icon:'submarines-icon.png'},
  {id:'missiles',name:'الصواريخ',image:'missiles-banner.jpg',icon:'missiles-icon.png'},
  {id:'officers',name:'الضباط',image:'officers-banner.jpg',icon:'officers-icon.png'}
];
function renderResearch() {
  $('mainPanel').classList.add('research-fullscreen');
  $('mainPanel').classList.remove('infantry-tree-screen');
  $('mainPanel').innerHTML=`<div class="panel-head"><strong>الأبحاث العسكرية</strong><button class="panel-close" data-close aria-label="إغلاق">×</button></div>
    <div class="research-tabs" role="group" aria-label="أقسام الأبحاث">
      <button class="research-tab is-active" type="button" data-research-tab="first"><span class="research-tab-image" aria-hidden="true">▧</span><b>البحث الأول</b></button>
      <button class="research-tab" type="button" data-research-tab="second"><span class="research-tab-image" aria-hidden="true">▧</span><b>البحث الثاني</b></button>
    </div>
    <div class="panel-content research-list">${RESEARCH_CATEGORIES.map(category=>`<button class="research-category-button" type="button" data-research-category="${category.id}" aria-label="${category.name}">
      <span class="research-category-art" style="background-image:url('assets/${category.image}')" aria-hidden="true"></span>
      <span class="research-category-logo"><img src="assets/${category.icon}" alt=""></span>
      <span class="research-category-copy"><b>${category.name}</b></span>
    </button>`).join('')}</div>`;
  $('mainPanel').querySelector('[data-close]').onclick=closePanels;
  $('mainPanel').querySelectorAll('[data-research-tab]').forEach(tab=>tab.onclick=()=>{
    $('mainPanel').querySelectorAll('[data-research-tab]').forEach(item=>item.classList.toggle('is-active',item===tab));
  });
  $('mainPanel').querySelectorAll('[data-research-category]').forEach(button=>button.onclick=()=>renderCategoryResearch(button.dataset.researchCategory));
}
function renderCategoryResearch(categoryId) {
  const category=RESEARCH_CATEGORIES.find(item=>item.id===categoryId)||RESEARCH_CATEGORIES[0];
  const panel=$('mainPanel');
  const campaignDay=Math.min(50,Math.floor(gameMinute/1440)+1);
  const renderTreeRows=()=>`<div class="category-two-tree-grid" dir="rtl" aria-label="مسارا البحث حتى اليوم الثاني عشر">
    ${Array.from({length:12},(_,i)=>{const d=i+1;return `<div class="category-two-tree-row ${d%2?'day-light':'day-dark'}" data-day-row="${d}">
      <div class="category-two-day-number">${d}</div>
      ${[1,2].map(tree=>`<div class="category-two-tree-cell"><span class="category-two-tree-line"></span><span class="category-two-empty-node" aria-hidden="true"></span></div>`).join('')}
    </div>`;}).join('')}
  </div>`;
  panel.classList.add('research-fullscreen','infantry-tree-screen');
  panel.innerHTML=`<div class="panel-head"><strong>أبحاث ${category.name}</strong><button class="panel-close" data-close aria-label="إغلاق">×</button></div>
    <div class="research-tabs" role="group" aria-label="أقسام الأبحاث">
      <button class="research-tab is-active" type="button" data-research-tab="first"><span class="research-tab-image" aria-hidden="true">▧</span><b>البحث الأول</b></button>
      <button class="research-tab" type="button" data-research-tab="second"><span class="research-tab-image" aria-hidden="true">▧</span><b>البحث الثاني</b></button>
    </div>
    <div class="infantry-tree-toolbar category-tree-toolbar" style="--category-tree-image:url('assets/${category.image}')">
      <div class="infantry-tree-title"><strong>شجرة أبحاث ${category.name}</strong></div>
      <div class="infantry-calendar"><span class="calendar-smile">📅</span><span>تقويم الحملة</span><b>اليوم ${campaignDay} / 50</b></div>
    </div>
    <div class="category-two-trees" aria-label="شجرتا أبحاث ${category.name}">
      <div class="category-two-tree-head"><span>الشجرة الأولى</span><span>الشجرة الثانية</span><span>اليوم</span></div>
      ${renderTreeRows()}
    </div>`;
  panel.querySelector('[data-close]').onclick=closePanels;
  panel.querySelectorAll('[data-research-tab]').forEach(tab=>tab.onclick=()=>panel.querySelectorAll('[data-research-tab]').forEach(t=>t.classList.toggle('is-active',t===tab)));
}
function renderInfantryResearch(){renderCategoryResearch('infantry');}
function showCategoryTechDetails(category,branch,day,treeNumber){
  const detail=$('dialogPanel'); detail.hidden=false;
  detail.innerHTML=`<div class="dialog-head"><strong>${category.name} — ${branch.name} — اليوم ${day}</strong><button id="dialogClose" aria-label="إغلاق">×</button></div>
    <div class="infantry-tech-detail"><div class="infantry-round-icon"><img src="assets/${category.icon}" alt=""></div>
      <strong>${branch.name}</strong><p>بحث من الشجرة ${treeNumber} ضمن أبحاث ${category.name}. ستُضاف تفاصيل التقنية ومتطلباتها عند تحديد محتوى البحث.</p>
      <div class="infantry-cost-section"><strong>متطلبات البحث</strong><div class="resource-costs"><span>💵 —</span><span>📟 —</span><span>⚙️ —</span></div></div>
      <div class="research-duration">وقت البحث <b>يُحدد لاحقاً</b></div></div>`;
  $('dialogClose').onclick=()=>detail.hidden=true;
}
function showInfantryTechDetails(branch,day) {
  const detail=$('dialogPanel'); detail.hidden=false;
  detail.innerHTML=`<div class="dialog-head"><strong>${branch.name} — اليوم ${day}</strong><button id="dialogClose" aria-label="إغلاق">×</button></div>
    <div class="infantry-tech-detail"><div class="infantry-round-icon"><img src="assets/infantry-icon.png" alt=""></div>
      <strong>بحث ${branch.name}</strong><p>هذا البحث جزء من شجرة تطوير قوات المشاة. ستُضاف تفاصيل التقنية ومتطلباتها عند تحديد محتوى البحث.</p>
      <div class="infantry-cost-section"><strong>متطلبات البحث</strong><div class="resource-costs"><span>💵 —</span><span>📟 —</span><span>⚙️ —</span></div></div>
      <div class="research-duration">وقت البحث <b>يُحدد لاحقاً</b></div>
    </div>`;
  $('dialogClose').onclick=()=>detail.hidden=true;
}
function startNewCampaignClock() {
  stopCampaignClock();
  resources=Object.fromEntries(Object.entries(RESOURCE_DEFS).map(([key,def])=>[key,def.stock]));
  recalculateEconomy();
  infantryResearch={status:'available',completesAt:null};
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
  const previousDay=Math.floor(gameMinute/1440)+1;
  gameMinute=Math.floor((Date.now()-gameStartedAt)/5000);
  const currentDay=Math.floor(gameMinute/1440)+1;
  for(let d=previousDay;d<currentDay;d++) applyDailyEconomy();
  if(infantryResearch.status==='running' && gameMinute>=infantryResearch.completesAt) {
    infantryResearch={status:'completed',completesAt:null};
    if(!$('dialogPanel').hidden && $('dialogPanel').querySelector('#infantryResearchStatus')) renderInfantryResearch();
    showToast('اكتمل بحث المشاة');
  }
  updateGameStatus();
}
function updateGameStatus() {
  const day=Math.floor(gameMinute/1440)+1;
  const minuteOfDay=gameMinute%1440;
  const hours=String(Math.floor(minuteOfDay/60)).padStart(2,'0');
  const minutes=String(minuteOfDay%60).padStart(2,'0');
  const date=$('gameDateTime');
  if(date) date.textContent=`اليوم ${day} · ${hours}:${minutes}`;
  renderResourceStrips();
  const campaignDayLabel=$('mainPanel').querySelector('.infantry-calendar b'); if(campaignDayLabel) campaignDayLabel.textContent=`اليوم ${Math.min(50,day)} / 50`;
  const treeDay=$('mainPanel')?.querySelector('.infantry-calendar b');
  if(treeDay) treeDay.textContent=`اليوم ${Math.min(50,day)} / 50`;
}
function recalculateEconomy() {
  resourceProduction={}; resourceConsumption={};
  Object.keys(RESOURCE_DEFS).forEach(key=>{resourceProduction[key]=0;resourceConsumption[key]=RESOURCE_DEFS[key].consumption;});
  const cities=CITY_MARKERS.filter(city=>selectedCountry&&city.country===selectedCountry.ar);
  cities.forEach(city=>{const p=CITY_PRODUCTION[city.name];if(p){resourceProduction[p.key]=(resourceProduction[p.key]||0)+p.amount;resourceProduction.money=(resourceProduction.money||0)+(p.money||0);resourceProduction.workforce=(resourceProduction.workforce||0)+(p.workforce||0);}});
}
function applyDailyEconomy() {
  recalculateEconomy();
  Object.keys(RESOURCE_DEFS).forEach(key=>{
    const net=(resourceProduction[key]||0)-(resourceConsumption[key]||0);
    resources[key]=Math.max(0,(resources[key]||0)+net);
  });
  renderResourceStrips();
}
function renderResourceStrips() {
  if(!selectedCountry)return;
  recalculateEconomy();
  const primary=['money','food','oil','workforce'], secondary=['supplies','iron','rubber','electronics','rare'];
  const render=(keys)=>keys.map(key=>`<button class="resource-chip" data-resource="${key}" aria-label="${RESOURCE_DEFS[key].name}"><span>${RESOURCE_DEFS[key].icon}</span><b>${Math.floor(resources[key]||0).toLocaleString('en-US')}</b><i>⌄</i></button>`).join('');
  $('primaryResources').innerHTML=render(primary); $('secondaryResources').innerHTML=render(secondary);
}
function openResourcePopover(key,anchor) {
  const def=RESOURCE_DEFS[key]; if(!def)return;
  const pop=$('resourcePopover'); const production=resourceProduction[key]||0, consumption=resourceConsumption[key]||0, net=production-consumption;
  pop.innerHTML=`<div class="resource-popover-title"><strong>${def.icon} ${def.name}</strong><button type="button" class="resource-popover-close" aria-label="إغلاق">×</button></div><div class="resource-detail-row"><span>المخزون</span><b>${Math.floor(resources[key]||0).toLocaleString('en-US')}</b></div><div class="resource-detail-row"><span>إنتاج الدولة اليومي</span><b class="positive">+${production.toLocaleString('en-US')}</b></div><div class="resource-detail-row"><span>استهلاك الدولة اليومي</span><b class="negative">−${consumption.toLocaleString('en-US')}</b></div><div class="resource-detail-row resource-net"><span>صافي التغير اليومي</span><b class="${net>=0?'positive':'negative'}">${net>=0?'+':''}${net.toLocaleString('en-US')}</b></div>`;
  const r=anchor.getBoundingClientRect(); pop.style.top=Math.max(8,Math.min(window.innerHeight-190,r.bottom+7))+'px'; pop.style.left=Math.max(8,Math.min(window.innerWidth-245,r.left-95))+'px'; pop.hidden=false;
  pop.querySelector('.resource-popover-close').onclick=()=>pop.hidden=true;
}
function renderCities() {
  const panel=$('mainPanel');
  const cities=CITY_MARKERS.filter(city=>city.countryId===selectedCountry?.id || city.country===selectedCountry?.ar);
  panel.hidden=false;
  panel.classList.add('cities-panel');
  panel.innerHTML=`<div class="panel-head"><strong>مدن ${selectedCountry?.ar||'الدولة'}</strong><button class="panel-close" data-close aria-label="إغلاق">×</button></div><div class="cities-list">${cities.length?cities.map((city,index)=>cityCardMarkup(city,index)).join(''):'<p class="empty-note">لا توجد مدن مسجلة لهذه الدولة حالياً</p>'}</div>`;
  panel.querySelector('[data-close]').onclick=closePanels;
  panel.querySelectorAll('[data-city-gps]').forEach(button=>button.addEventListener('click',()=>focusCity(button.dataset.cityGps)));
  panel.querySelectorAll('[data-city-action]').forEach(button=>button.addEventListener('click',()=>{
    const city=cities[Number(button.dataset.cityAction)];
    if(!city)return;
    const kind=button.dataset.actionKind;
    showToast(kind==='army'?'تجهيز الجيش في '+city.name:'البناء في '+city.name);
  }));
}
function cityCardMarkup(city,index) {
  const production=CITY_PRODUCTION[city.name]||{key:'food',amount:0,money:0,workforce:0};
  const resource=RESOURCE_DEFS[production.key]||RESOURCE_DEFS.food;
  const workforce=Math.max(0,Number(production.workforce)||0);
  const population=workforce*3;
  const happiness=Number(city.happiness??75);
  const smile=happiness>=80?'😄':happiness>=60?'😊':happiness>=40?'😐':happiness>=20?'😟':'😢';
  const home=(city.ownerCountryId||city.countryId)===selectedCountry?.id && !city.occupied;
  const status=home?'مدينة وطن':'مدينة تحت السيطرة';
  const operation=city.operation||null;
  const progress=operation?Math.max(0,Math.min(100,Number(operation.progress)||0)):0;
  const opText=operation?`${operation.name||'عملية جارية'} · ${progress}% · ${operation.remaining||'الوقت غير محدد'}`:'لا توجد عملية جارية';
  return `<article class="city-management-card">
    <div class="city-card-top"><button class="city-gps" type="button" data-city-gps="${city.name}" aria-label="الانتقال إلى ${city.name}" title="الانتقال إلى المدينة"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg></button><div class="city-card-name">${city.name}</div><div class="city-status ${home?'is-home':'is-controlled'}">${status}</div></div>
    <div class="city-card-data"><div class="city-resource-grid">
      <div class="city-resource"><span class="city-resource-icon">${resource.icon}</span><b>${Number(production.amount||0).toLocaleString('en-US')}</b><small>${resource.name}</small></div>
      <div class="city-resource"><span class="city-resource-icon">💵</span><b>${Number(production.money||0).toLocaleString('en-US')}</b><small>الدولارات</small></div>
      <div class="city-resource"><span class="city-resource-icon">👷</span><b>${workforce.toLocaleString('en-US')}</b><small>القوى العاملة</small></div>
      <div class="city-resource"><span class="city-resource-icon">👥</span><b>${population.toLocaleString('en-US')}</b><small>السكان</small></div>
    </div><div class="city-happiness"><span class="city-smile">${smile}</span><b>${happiness}%</b><small>السعادة</small><div class="city-meter"><i style="width:${happiness}%"></i></div></div></div>
    <div class="city-photo-slots" aria-label="أماكن صور مستقبلية">${Array.from({length:5},()=>'<div class="city-photo-slot"><span>＋</span></div>').join('')}</div>
    <div class="city-operations">
      <button class="city-operation" type="button" data-city-action="${index}" data-action-kind="army"><span class="operation-icon"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 23h18l-1.5-7a7.5 7.5 0 0 0-15 0L7 23Z"/><path d="M5 24h22v3H5zM11 13h10M16 9v4"/></svg></span><span class="operation-copy"><b>تجهيز الجيش</b><small>${operation?.kind==='army'?opText:'لا يوجد تجهيز حالياً'}</small>${operation?.kind==='army'?`<i class="operation-meter"><em style="width:${progress}%"></em></i>`:''}</span></button>
      <button class="city-operation" type="button" data-city-action="${index}" data-action-kind="build"><span class="operation-icon"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 27h22M9 27V9h2v18M10 9h13M23 9v4M20 13h6M21 13l-3 5h9l-3-5M7 9l3-4 3 4M6 18h5M6 18l-2 3h7l-2-3"/></svg></span><span class="operation-copy"><b>البناء</b><small>${operation?.kind==='build'?opText:'لا يوجد بناء حالياً'}</small>${operation?.kind==='build'?`<i class="operation-meter"><em style="width:${progress}%"></em></i>`:''}</span></button>
    </div>
  </article>`;
}
function focusCity(cityName) {
  const city=CITY_MARKERS.find(item=>item.name===cityName && (item.countryId===selectedCountry?.id || item.country===selectedCountry?.ar));
  if(!city||!svg)return;
  const [x,y]=project([city.lon,city.lat]);
  const targetZoom= Math.max(overviewViewWidth/Math.min(view.w,overviewViewWidth/12),12);
  const targetW=overviewViewWidth/Math.min(18,Math.max(12,targetZoom));
  view={x:x-targetW/2,y:y-(targetW*view.h/view.w)/2,w:targetW,h:targetW*view.h/view.w};
  if(typeof constrainCamera==='function')constrainCamera();
  updateView();
  showToast('تم الانتقال إلى '+city.name);
}
function showCityPanel(city) {
  selectedCity=city; activePanel=null;
  $('mainPanel').hidden=true; $('bottomNav').hidden=true; $('dialogPanel').hidden=true;
  $('selectionPanel').hidden=false;
  const previous=city.happiness??75;
  const production=CITY_PRODUCTION[city.name]||{key:'food',amount:0,money:0,workforce:0};
  const resource=RESOURCE_DEFS[production.key]||RESOURCE_DEFS.food;
  $('selectionPanel').innerHTML=`<div class="selection-city-head"><strong>🏙️ ${city.name}</strong><button class="panel-close" id="selectionClose">×</button></div><div class="city-summary-grid"><div class="city-summary-item"><span>${resource.icon} ${resource.name}</span><b>+${production.amount.toLocaleString('en-US')}</b></div><div class="city-summary-item"><span>💵 الدولارات</span><b>+${(production.money||0).toLocaleString('en-US')}</b></div><div class="city-summary-item"><span>👷 القوى العاملة</span><b>${(production.workforce||0).toLocaleString('en-US')}</b></div><div class="city-summary-item"><span>👥 السكان</span><b>${((production.workforce||0)*3).toLocaleString('en-US')}</b></div><div class="city-summary-item happiness"><span>😊 السعادة</span><b>${previous}%</b></div></div><div class="selection-actions"><button id="cityBuild">🏗 البناء</button><button id="cityArmy">⚔ تجهيز الجيش</button></div>`;
  $('selectionClose').onclick=closePanels;
  $('cityArmy').onclick=()=>showToast('تجهيز الجيش في '+city.name);
  $('cityBuild').onclick=()=>showToast('البناء في '+city.name);
}
function showRegionPanel(feature) {
  $('selectionPanel').style.cssText='';
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
  $('countryFlagButton').addEventListener('click',()=>{
    const pop=$('countryPopover'); pop.hidden=!pop.hidden;
    $('countryFlagButton').setAttribute('aria-expanded',String(!pop.hidden));
  });
  document.addEventListener('click',e=>{
    const chip=e.target.closest('[data-resource]');
    if(chip){$('countryPopover').hidden=true;openResourcePopover(chip.dataset.resource,chip);return;}
    if(!$('resourcePopover').hidden&&!$('resourcePopover').contains(e.target))$('resourcePopover').hidden=true;
  });
  document.addEventListener('pointerdown',e=>{
    if(!$('countryPopover').hidden&&!$('countryPopover').contains(e.target)&&!$('countryFlagButton').contains(e.target)){
      $('countryPopover').hidden=true;$('countryFlagButton').setAttribute('aria-expanded','false');
    }
  });
}
if(!Array.isArray(window.WD_COUNTRY_LIST) || !window.WD_COUNTRY_LIST.length) {
  console.error('WORLD DOMINION: country-list.js is missing or invalid.');
  $('startButton').addEventListener('click',()=>alert('تعذّر تحميل قائمة الدول. تأكد من وجود ملفات البيانات.'));
} else {
  initInterface();
}
