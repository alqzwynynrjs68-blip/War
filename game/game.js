const $=s=>document.querySelector(s);
const startScreen=$('#startScreen'),countryScreen=$('#countryScreen'),gameScreen=$('#gameScreen');
$('#startBtn').onclick=()=>{startScreen.classList.add('hidden');countryScreen.classList.remove('hidden')};
$('#backStart').onclick=()=>{countryScreen.classList.add('hidden');startScreen.classList.remove('hidden')};
$('#menuBtn').onclick=()=>{gameScreen.classList.add('hidden');countryScreen.classList.remove('hidden')};
const cities=[
 {id:'baghdad',name:'بغداد',province:'بغداد',lon:44.3661,lat:33.3152,capital:true,buildings:4},
 {id:'ramadi',name:'الرمادي',province:'الأنبار',lon:43.305,lat:33.423,buildings:3},
 {id:'basra',name:'البصرة',province:'البصرة',lon:47.7804,lat:30.5085,buildings:3},
 {id:'najaf',name:'النجف',province:'النجف',lon:44.015,lat:32,buildings:3},
 {id:'sulaymaniyah',name:'السليمانية',province:'السليمانية',lon:45.4351,lat:35.5613,buildings:3},
 {id:'mosul',name:'الموصل',province:'نينوى',lon:43.1189,lat:36.335,buildings:3},
 {id:'amara',name:'العمارة',province:'ميسان',lon:47.1408,lat:31.8356,buildings:2},
 {id:'kut',name:'الكوت',province:'واسط',lon:45.8182,lat:32.5128,buildings:2}
];
const names={'IQ-AN':'الأنبار','IQ-KA':'كربلاء','IQ-NA':'النجف','IQ-BB':'بابل','IQ-BG':'بغداد','IQ-QA':'القادسية','IQ-MU':'المثنى','IQ-DQ':'ذي قار','IQ-BA':'البصرة','IQ-MA':'ميسان','IQ-WA':'واسط','IQ-NI':'نينوى','IQ-DA':'دهوك','IQ-SD':'صلاح الدين','IQ-DI':'ديالى','IQ-KI':'كركوك','IQ-AR':'أربيل','IQ-SU':'السليمانية'};
const svgNS='http://www.w3.org/2000/svg',svg=$('#iraqMap');
function el(tag,attrs={},parent=svg){const n=document.createElementNS(svgNS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));parent.appendChild(n);return n}
const project=([lon,lat])=>[(lon-38.5)*85.714,(37.5-lat)*95];
function geometryPaths(geometry){let polys=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;return polys.map(poly=>poly.map(ring=>ring.map((p,i)=>{let [x,y]=project(p);return `${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`} ).join(' ')+' Z').join(' ')).join(' ')}
function addCity(c){let [x,y]=project([c.lon,c.lat]),g=el('g',{class:`city-marker ${c.capital?'capital':''}`,transform:`translate(${x} ${y})`,'data-city':c.id});el('ellipse',{class:'shadow',cx:0,cy:3,rx:c.capital?21:16,ry:6},g);el('rect',{class:'base',x:-16,y:-13,width:32,height:17,rx:3},g);let count=c.buildings;for(let i=0;i<count;i++){let bx=-12+i*9,by=-22-(i%2)*3;el('rect',{class:'building',x:bx,y:by,width:7,height:12+(i%2)*3,rx:1},g);el('path',{class:'roof',d:`M${bx-1} ${by} l4 -5 l4 5 z`},g)}let t=el('text',{x:0,y:20},g);t.textContent=c.name;g.addEventListener('click',e=>{e.stopPropagation();selectCity(c)});}
function selectProvince(feature,path){document.querySelectorAll('.province').forEach(p=>p.classList.remove('selected'));document.querySelectorAll('.city-marker').forEach(c=>c.classList.remove('selected'));path.classList.add('selected')}
function selectCity(c){document.querySelectorAll('.city-marker').forEach(marker=>marker.classList.remove('selected'));document.querySelectorAll('.province').forEach(p=>p.classList.remove('selected'));const marker=svg.querySelector(`[data-city="${c.id}"]`);if(marker)marker.classList.add('selected')}
async function init(){const [geo,citiesData]=await Promise.all([fetch('./game/data/iraq-provinces.geojson').then(r=>r.json()),fetch('./game/data/cities.json').then(r=>r.json())]);
// Geometry is local; city definitions are kept in the same project data folder.
const allCoords=[];geo.features.forEach(f=>{let g=f.geometry,polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;polys.forEach(poly=>poly.forEach(r=>r.forEach(p=>allCoords.push(p))))});
geo.features.forEach(f=>{let path=el('path',{d:geometryPaths(f.geometry),class:'province','data-iso':f.properties.shapeISO});path.addEventListener('click',()=>selectProvince(f,path));});
// province labels at geographic centroids derived from the boundary coordinates
geo.features.forEach(f=>{let pts=[];let polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;polys.forEach(poly=>poly[0].forEach(p=>pts.push(p)));let lon=pts.reduce((s,p)=>s+p[0],0)/pts.length,lat=pts.reduce((s,p)=>s+p[1],0)/pts.length;let [x,y]=project([lon,lat]);let t=el('text',{x,y,class:'province-label'});t.textContent=f.properties.name_ar||names[f.properties.shapeISO]});
citiesData.forEach(addCity);
const buttons=$('#cityButtons');buttons.className='city-buttons';citiesData.forEach(c=>{let b=document.createElement('button');b.textContent=(c.capital?'★ ':'')+c.name;b.onclick=()=>selectCity(c);buttons.appendChild(b)});
}
$('#iraqChoice').onclick=()=>{countryScreen.classList.add('hidden');gameScreen.classList.remove('hidden');init().catch(err=>{console.error(err);$('#details').textContent='تعذر تحميل بيانات الخريطة المحلية.'})};

// واجهة إدارة الدولة والتحكم بالخريطة
const mapSvg=$('#iraqMap'),mapViewport=$('#mapViewport');
let mapView={x:0,y:0,w:900,h:855},drag=null,zoomLevel=1;
function applyMapView(){mapSvg.setAttribute('viewBox',`${mapView.x} ${mapView.y} ${mapView.w} ${mapView.h}`)}
function zoomMap(factor,cx=mapView.x+mapView.w/2,cy=mapView.y+mapView.h/2){const nw=Math.max(260,Math.min(1400,mapView.w/factor)),nh=nw*855/900;const rx=(cx-mapView.x)/mapView.w,ry=(cy-mapView.y)/mapView.h;mapView.x=cx-rx*nw;mapView.y=cy-ry*nh;mapView.w=nw;mapView.h=nh;zoomLevel=900/nw;applyMapView()}
function resetMap(){mapView={x:0,y:0,w:900,h:855};zoomLevel=1;applyMapView()}
$('#zoomIn').onclick=()=>zoomMap(1.25);$('#zoomOut').onclick=()=>zoomMap(.8);$('#zoomReset').onclick=resetMap;
mapViewport.addEventListener('wheel',e=>{e.preventDefault();const r=mapSvg.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*mapView.w+mapView.x,y=(e.clientY-r.top)/r.height*mapView.h+mapView.y;zoomMap(e.deltaY<0?1.15:.87,x,y)},{passive:false});
mapViewport.addEventListener('pointerdown',e=>{if(e.target.closest('.zoom-tools'))return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,viewX:mapView.x,viewY:mapView.y,moved:false};mapViewport.setPointerCapture(e.pointerId);mapViewport.classList.add('dragging')});
mapViewport.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const r=mapSvg.getBoundingClientRect(),dx=(e.clientX-drag.x)/r.width*mapView.w,dy=(e.clientY-drag.y)/r.height*mapView.h;if(Math.abs(dx)+Math.abs(dy)>2)drag.moved=true;if(drag.moved){mapView.x=drag.viewX-dx;mapView.y=drag.viewY-dy;applyMapView()}});
function endDrag(){drag=null;mapViewport.classList.remove('dragging')};mapViewport.addEventListener('pointerup',endDrag);mapViewport.addEventListener('pointercancel',endDrag);
// منع سحب الخريطة من تعطيل اختيار عناصرها عند النقر دون تحريك
const oldProvinceHandlerNote='';

const modal=$('#gameModal'),modalTitle=$('#modalTitle'),modalContent=$('#modalContent');
function showModal(title,html){modalTitle.textContent=title;modalContent.innerHTML=html;modal.classList.remove('hidden')}
function closeModal(){modal.classList.add('hidden')}
$('#closeModal').onclick=closeModal;modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
const economy={
 money:250000,oil:1250,gold:320,electronics:85,iron:760,rubber:240,food:8400,supplies:1900,
 population:'45.2 مليون',income:18500,expenses:12300,
 flow:{
  money:{production:18500,consumption:12300,unit:'دولار'},
  oil:{production:145,consumption:55,unit:'برميل'},
  gold:{production:3,consumption:1,unit:'وحدة'},
  electronics:{production:2,consumption:4,unit:'وحدة'},
  iron:{production:38,consumption:22,unit:'طن'},
  rubber:{production:12,consumption:9,unit:'طن'},
  food:{production:520,consumption:410,unit:'طن'},
  supplies:{production:65,consumption:48,unit:'وحدة'}
 }
};
const resourceDefinitions=[
 ['gold','الذهب','🪙'],['oil','النفط','🛢️'],['electronics','الإلكترونيات','💻'],['iron','الحديد','⛓️'],
 ['rubber','المطاط','⚙️'],['food','الغذاء','🌾'],['supplies','الإمدادات','📦'],['money','المال','💰']
];
function statePanel(){
 const cards=resourceDefinitions.map(([key,name,icon])=>{const f=economy.flow[key],stock=economy[key];return `<article class="resource-ledger"><div class="ledger-title"><span class="ledger-icon">${icon}</span><b>${name}</b></div><div class="ledger-values"><div><small>الإنتاج / يوم</small><b class="positive">+${f.production.toLocaleString('en-US')}</b></div><div><small>الاستهلاك / يوم</small><b class="negative">-${f.consumption.toLocaleString('en-US')}</b></div><div><small>المخزون</small><b>${Number(stock).toLocaleString('en-US')}</b></div></div><small class="ledger-unit">${f.unit} يومياً • صافي التغير: <strong class="${f.production-f.consumption>=0?'positive':'negative'}">${f.production-f.consumption>=0?'+':''}${(f.production-f.consumption).toLocaleString('en-US')}</strong></small></article>`}).join('');
 showModal('الدولة — جمهورية العراق',`<div class="section-block"><h3>نظرة عامة</h3><div class="resource-grid"><div class="info-card"><small>السكان</small><b>👥 ${economy.population}</b></div><div class="info-card"><small>المحافظات</small><b>18 محافظة</b></div><div class="info-card"><small>الإيرادات اليومية</small><b class="positive">+${economy.income.toLocaleString('en-US')} 💰</b></div><div class="info-card"><small>النفقات اليومية</small><b class="negative">-${economy.expenses.toLocaleString('en-US')} 💰</b></div><div class="info-card"><small>صافي الميزانية</small><b>${(economy.income-economy.expenses).toLocaleString('en-US')} 💰</b></div><div class="info-card"><small>العاصمة</small><b>بغداد</b></div></div></div><div class="section-block"><h3>الموارد والمخازن</h3><p class="section-note">الإنتاج والاستهلاك محسوبان لكل يوم داخل اللعبة، والمخزون هو الكمية المتوفرة حالياً.</p><div class="resource-ledger-grid">${cards}</div></div><p class="prototype-note">قيم الإنتاج والاستهلاك والمخزون تجريبية حالياً، وسيتم ربطها لاحقاً بالوقت والمباني والقرارات الاقتصادية.</p>`)
}
function diplomacyPanel(){showModal('الدبلوماسية',`<div class="section-block"><h3>الدول المتاحة في الخريطة الحالية</h3><div class="country-list"><div class="country-row"><span>🇮🇶 جمهورية العراق</span><em>دولتك • نشطة</em></div></div></div><div class="section-block"><h3>ميزات دبلوماسية مخطط لها</h3><div class="country-list">${[['🇸🇦 السعودية','السعودية'],['🇮🇷 إيران','إيران'],['🇹🇷 تركيا','تركيا'],['🇰🇼 الكويت','الكويت'],['🇯🇴 الأردن','الأردن'],['🇸🇾 سوريا','سوريا']].map(([flag,n])=>`<div class="country-row"><span>${flag}</span><em>ستضاف عند توسيع خريطة العالم</em></div>`).join('')}</div></div><button class="action-btn" disabled>إنشاء تحالف — قريباً</button><button class="action-btn" disabled>مراسلة دولة — قريباً</button><button class="action-btn" disabled>مراسلة التحالف — قريباً</button><p>حالياً الخريطة تحتوي العراق فقط؛ ستُفعّل العلاقات والتحالفات والمراسلات بعد إضافة الدول الأخرى ونظام الدبلوماسية.</p>`)}
function tradePanel(){showModal('التجارة الدولية',`<div class="section-block"><h3>مركز التجارة</h3><div class="resource-grid"><div class="info-card"><small>اتفاقيات تجارية</small><b>0</b></div><div class="info-card"><small>شركاء تجاريون</small><b>0</b></div></div></div><h3>عمليات التجارة</h3><button class="action-btn" disabled>تصدير الموارد</button><button class="action-btn" disabled>استيراد الموارد</button><p>لن تتاح عمليات الاستيراد والتصدير إلا بعد إضافة دول أخرى وإقامة تحالف أو توقيع عقد تجارة معها. هذه الأزرار معطلة حالياً حتى لا تنفذ تجارة وهمية.</p>`)}
const infantryUnits=[
 {id:'regular',name:'مشاة عاديون',desc:'قوات المشاة الأساسية للسيطرة على الأراضي وحماية المدن.',cost:5000,time:'قصير',symbol:'infantry'},
 {id:'marines',name:'مشاة البحرية',desc:'قوات مدربة على الإنزال والعمليات الساحلية والجزر.',cost:8500,time:'متوسط',symbol:'marines'},
 {id:'heli',name:'مشاة مع هليكوبتر',desc:'وحدات مشاة تنتقل وتُسنَد بواسطة المروحيات.',cost:11000,time:'متوسط',symbol:'heli'},
 {id:'special',name:'مشاة قوات خاصة',desc:'وحدات نخبة للمهام الخاصة والاستطلاع.',cost:15000,time:'طويل',symbol:'special'},
 {id:'civil',name:'مشاة دفاع مدني',desc:'وحدات لحماية السكان والاستجابة للكوارث والطوارئ.',cost:6500,time:'قصير',symbol:'civil'}
];
const researches=[{id:'logistics',name:'اللوجستيات العسكرية',desc:'تحسين إدارة الإمدادات والمخازن.',cost:8500,done:false},{id:'industry',name:'التصنيع المتقدم',desc:'يمهد لتطوير إنتاج الحديد والإلكترونيات.',cost:12000,done:false}];
const researchedUnits=new Set();
function unitArt(kind){
 const common='<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#587b78"/><stop offset="1" stop-color="#1b3440"/></linearGradient></defs><rect width="180" height="112" rx="13" fill="url(#g)"/><path d="M0 88 Q45 70 90 88 T180 84 V112 H0Z" fill="#182a31"/>';
 const art={
 infantry:'<circle cx="88" cy="27" r="12" fill="#d7b98b"/><path d="M72 45 L105 45 L114 88 L65 88Z" fill="#7d895d"/><path d="M75 49 L48 72 M101 50 L126 68" stroke="#d7b98b" stroke-width="8" stroke-linecap="round"/><path d="M80 87 L75 105 M101 87 L108 105" stroke="#252f31" stroke-width="10" stroke-linecap="round"/><path d="M69 23 Q88 2 107 23Z" fill="#536346"/><path d="M116 58 L150 46" stroke="#1b2021" stroke-width="7" stroke-linecap="round"/>',
 marines:'<circle cx="88" cy="28" r="11" fill="#d7b98b"/><path d="M69 45 L107 45 L113 86 L64 86Z" fill="#456c78"/><path d="M70 52 L47 72 M105 52 L130 68" stroke="#d7b98b" stroke-width="8" stroke-linecap="round"/><path d="M78 85 L73 105 M101 85 L108 105" stroke="#26363a" stroke-width="10" stroke-linecap="round"/><path d="M70 23 Q88 5 106 23Z" fill="#324e58"/><path d="M18 86 Q45 75 66 86" stroke="#80b6c2" stroke-width="4" fill="none"/>',
 heli:'<path d="M31 31 H149 M89 31 V16 M75 16 H103" stroke="#d5c69c" stroke-width="4" stroke-linecap="round"/><path d="M48 42 Q85 22 124 42 L136 57 L113 70 H57 L42 57Z" fill="#73845e" stroke="#c5cda4" stroke-width="2"/><path d="M68 44 H105 L113 58 H62Z" fill="#a9c5c3"/><path d="M87 70 V78 M112 70 L130 78" stroke="#1b272a" stroke-width="4"/><circle cx="67" cy="87" r="7" fill="#d7b98b"/><path d="M59 95 L77 95 L81 109 H54Z" fill="#7d895d"/>',
 special:'<circle cx="88" cy="27" r="11" fill="#d7b98b"/><path d="M68 43 L108 43 L115 87 L61 87Z" fill="#343f42"/><path d="M69 50 L48 70 M106 50 L129 67" stroke="#d7b98b" stroke-width="8" stroke-linecap="round"/><path d="M77 85 L72 105 M102 85 L110 105" stroke="#20292b" stroke-width="10" stroke-linecap="round"/><path d="M65 24 Q88 2 111 24 L105 31 H71Z" fill="#252e31"/><path d="M75 35 H101" stroke="#252e31" stroke-width="7"/>',
 civil:'<circle cx="88" cy="27" r="11" fill="#d7b98b"/><path d="M69 44 L107 44 L113 87 L63 87Z" fill="#d2a64d"/><path d="M70 51 L48 71 M105 51 L128 70" stroke="#d7b98b" stroke-width="8" stroke-linecap="round"/><path d="M78 86 L73 105 M101 86 L108 105" stroke="#303a3b" stroke-width="10" stroke-linecap="round"/><path d="M69 23 Q88 4 107 23Z" fill="#d2a64d"/><path d="M88 48 V78 M75 63 H101" stroke="#f5f1dc" stroke-width="5"/>'
 };
 return `<svg class="unit-art" viewBox="0 0 180 112" role="img" aria-label="رسم توضيحي ${kind}">${common}${art[kind]}</svg>`;
}
function researchPanel(){
 const unitCards=infantryUnits.map(u=>`<button class="unit-card ${researchedUnits.has(u.id)?'researched':''}" data-unit="${u.id}">${unitArt(u.symbol)}<span class="unit-card-name">${u.name}</span><small>${researchedUnits.has(u.id)?'تم فتح البحث':'بحث جديد'}</small></button>`).join('');
 const techCards=researches.map(r=>`<div class="research-row"><div><b>${r.name}</b><small>${r.desc}</small><small>الكلفة: ${r.cost.toLocaleString('en-US')} 💰</small><div class="progress"><i style="width:${r.done?100:0}%"></i></div></div><button class="action-btn" data-research="${r.id}" ${r.done?'disabled':''}>${r.done?'مكتمل':'ابدأ البحث'}</button></div>`).join('');
 showModal('مركز البحث العلمي',`<div class="research-category"><h3>المشاة</h3><p class="section-note">اختر نوع القوات لعرض تفاصيلها وبدء البحث العلمي اللازم لفتحها.</p><div class="unit-card-grid">${unitCards}</div></div><div id="unitResearchDetail" class="unit-research-detail"><p>اختر إحدى وحدات المشاة أعلاه لعرض تفاصيل البحث.</p></div><div class="section-block other-research"><h3>أبحاث أخرى</h3>${techCards}</div>`);
 modalContent.querySelectorAll('[data-unit]').forEach(b=>b.onclick=()=>{modalContent.querySelectorAll('[data-unit]').forEach(x=>x.classList.toggle('chosen',x===b));const u=infantryUnits.find(x=>x.id===b.dataset.unit),opened=researchedUnits.has(u.id);const detail=modalContent.querySelector('#unitResearchDetail');detail.innerHTML=`<div class="unit-detail-head">${unitArt(u.symbol)}<div><h4>${u.name}</h4><p>${u.desc}</p><small>مدة البحث التقديرية: ${u.time} • التكلفة: ${u.cost.toLocaleString('en-US')} 💰</small></div></div><button class="action-btn unit-research-btn" ${opened?'disabled':''}>${opened?'تم فتح الوحدة':'ابدأ بحث '+u.name}</button>`;detail.querySelector('button').onclick=()=>{if(opened)return;if(economy.money<u.cost){alert('لا توجد أموال كافية لبدء البحث.');return}economy.money-=u.cost;researchedUnits.add(u.id);researchPanel();const card=modalContent.querySelector(`[data-unit="${u.id}"]`);if(card)card.click()}});
 modalContent.querySelectorAll('[data-research]').forEach(b=>b.onclick=()=>{const r=researches.find(x=>x.id===b.dataset.research);if(!r||r.done)return;if(economy.money<r.cost){alert('لا توجد أموال كافية لبدء البحث.');return}economy.money-=r.cost;r.done=true;researchPanel()});
}
const tabs={state:statePanel,diplomacy:diplomacyPanel,trade:tradePanel,research:researchPanel};
document.querySelectorAll('.bottom-nav button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.toggle('active',x===b));tabs[b.dataset.tab]?.()}));
// اختيار المحافظة أو المدينة يغيّر التحديد البصري فقط، دون فتح أي نافذة أو بطاقة معلومات.
selectProvince=function(feature,path){document.querySelectorAll('.province').forEach(p=>p.classList.remove('selected'));document.querySelectorAll('.city-marker').forEach(c=>c.classList.remove('selected'));path.classList.add('selected')};
selectCity=function(c){document.querySelectorAll('.city-marker').forEach(marker=>marker.classList.remove('selected'));document.querySelectorAll('.province').forEach(p=>p.classList.remove('selected'));const marker=svg.querySelector(`[data-city="${c.id}"]`);if(marker)marker.classList.add('selected')};
