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
 {id:'regular',name:'مشاة عاديون',desc:'قوات المشاة الأساسية لحماية المدن والسيطرة على الأراضي.',cost:5000,duration:90,image:'infantry.webp'},
 {id:'marines',name:'مشاة البحرية',desc:'قوات متخصصة في الإنزال والعمليات الساحلية والقتال قرب السواحل.',cost:8500,duration:150,image:'marines.webp'},
 {id:'heli',name:'مشاة مع هليكوبتر',desc:'وحدات مشاة مدعومة بالمروحيات لنقل الجنود والإسناد الجوي.',cost:11000,duration:180,image:'heli-infantry.webp'},
 {id:'special',name:'مشاة قوات خاصة',desc:'قوات نخبة مدربة على الاستطلاع والمهام الخاصة عالية الخطورة.',cost:15000,duration:240,image:'special-forces.webp'},
 {id:'civil',name:'مشاة دفاع مدني',desc:'فرق حماية وإنقاذ وإخلاء واستجابة للكوارث والطوارئ.',cost:6500,duration:120,image:'civil-defense.webp'}
];
const heavyAircraft=[
 {id:'maritime-recon',name:'طائرة استطلاع بحري',desc:'طائرة مراقبة بعيدة المدى لمتابعة التحركات البحرية ورصد السواحل.',cost:18000,duration:300,image:'maritime-recon.webp'},
 {id:'bomber',name:'قاذفات القنابل',desc:'طائرات ثقيلة مخصصة لمهام القصف الاستراتيجي داخل عالم اللعبة.',cost:26000,duration:420,image:'bomber.webp'}
];
const researches=[{id:'logistics',name:'اللوجستيات العسكرية',desc:'تحسين إدارة الإمدادات والمخازن.',cost:8500,duration:180,done:false},{id:'industry',name:'التصنيع المتقدم',desc:'يمهد لتطوير إنتاج الحديد والإلكترونيات.',cost:12000,duration:240,done:false}];
const researchStates={};
function formatResearchTime(seconds){const s=Math.max(0,Math.ceil(seconds));const m=Math.floor(s/60),r=s%60;return m?`${m} دقيقة ${r} ثانية`:`${r} ثانية`}
function researchStatus(item){const state=researchStates[item.id];if(!state)return 'لم يبدأ';if(state.done)return 'مكتمل';return 'جارٍ البحث'}
function researchCard(item){const state=researchStates[item.id],done=!!state?.done,running=!!state&&!done;return `<button class="unit-card ${done?'researched':''} ${running?'research-running':''}" data-unit="${item.id}"><img class="unit-photo" src="./game/assets/research/${item.image}" alt="${item.name}" loading="lazy"><span class="unit-card-name">${item.name}</span><small>${done?'بحث مكتمل':running?'جارٍ البحث':'بحث جديد'}</small></button>`}
function researchPanel(){
 let activeCategory='infantry';
 const render=()=>{
  const items=activeCategory==='infantry'?infantryUnits:heavyAircraft;
  const tabsHtml=`<div class="research-tabs"><button class="research-tab ${activeCategory==='infantry'?'active':''}" data-category="infantry">المشاة</button><button class="research-tab ${activeCategory==='heavy'?'active':''}" data-category="heavy">الطائرات الثقيلة</button></div>`;
  const cards=items.map(researchCard).join('');
  const techCards=researches.map(r=>`<div class="research-row"><div><b>${r.name}</b><small>${r.desc}</small><small>التكلفة: ${r.cost.toLocaleString('en-US')} 💰 • المدة: ${formatResearchTime(r.duration)}</small><div class="progress"><i style="width:${r.done?100:0}%"></i></div></div><button class="action-btn" data-research="${r.id}" ${r.done?'disabled':''}>${r.done?'مكتمل':'عرض البحث'}</button></div>`).join('');
  showModal('مركز البحث العلمي',`<div class="research-layout"><aside class="research-side"><h3>الأقسام</h3>${tabsHtml}<div class="research-side-note">اختر القسم لعرض الوحدات المتاحة للبحث.</div></aside><section class="research-main"><div class="research-banner"><div><h3>${activeCategory==='infantry'?'تطوير قوات المشاة':'تطوير الطائرات الثقيلة'}</h3><p>${activeCategory==='infantry'?'تدريب وتجهيز تشكيلات المشاة المختلفة.':'تطوير قدرات الاستطلاع الجوي والعمليات الجوية الثقيلة.'}</p></div></div><div class="unit-card-grid">${cards}</div><div id="unitResearchDetail" class="unit-research-detail"><p>اختر بطاقة لعرض الصورة والتكلفة ومدة البحث.</p></div></section></div><div class="section-block other-research"><h3>أبحاث مساندة</h3>${techCards}</div>`);
  modalContent.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{activeCategory=b.dataset.category;render()});
  modalContent.querySelectorAll('[data-unit]').forEach(b=>b.onclick=()=>{
   modalContent.querySelectorAll('[data-unit]').forEach(x=>x.classList.toggle('chosen',x===b));
   const u=[...infantryUnits,...heavyAircraft].find(x=>x.id===b.dataset.unit),state=researchStates[u.id],detail=modalContent.querySelector('#unitResearchDetail');
   const remaining=state&&!state.done?(state.endAt-Date.now())/1000:0;
   const progress=state?.done?100:state?Math.min(100,Math.max(0,(1-remaining/u.duration)*100)):0;
   detail.innerHTML=`<div class="unit-detail-head"><img class="unit-detail-photo" src="./game/assets/research/${u.image}" alt="${u.name}"><div><h4>${u.name}</h4><p>${u.desc}</p><div class="research-meta"><span>التكلفة: <b>${u.cost.toLocaleString('en-US')} 💰</b></span><span>مدة البحث: <b>${formatResearchTime(u.duration)}</b></span><span>الحالة: <b>${researchStatus(u)}</b></span></div></div></div><div class="research-progress-wrap"><div class="progress"><i id="selectedResearchProgress" style="width:${progress}%"></i></div><small id="selectedResearchTime">${state?.done?'اكتمل البحث':state?`الوقت المتبقي: ${formatResearchTime(remaining)}`:'لم يبدأ البحث بعد'}</small></div><button class="action-btn unit-research-btn" id="startSelectedResearch" ${state?'disabled':''}>${state?.done?'تم إكمال البحث':state?'البحث جارٍ':'بدء البحث'}</button>`;
   const start=detail.querySelector('#startSelectedResearch');start.onclick=()=>{if(researchStates[u.id])return;if(economy.money<u.cost){alert('لا توجد أموال كافية لبدء البحث.');return}economy.money-=u.cost;researchStates[u.id]={startedAt:Date.now(),endAt:Date.now()+u.duration*1000,done:false};render();const card=modalContent.querySelector(`[data-unit="${u.id}"]`);if(card)card.click()};
  });
  modalContent.querySelectorAll('[data-research]').forEach(b=>b.onclick=()=>{const r=researches.find(x=>x.id===b.dataset.research);if(!r||r.done)return;if(economy.money<r.cost){alert('لا توجد أموال كافية لبدء البحث.');return}economy.money-=r.cost;r.done=true;researchPanel()});
 };
 render();
}
setInterval(()=>{
 Object.entries(researchStates).forEach(([id,state])=>{if(!state.done&&Date.now()>=state.endAt)state.done=true});
 const detail=modalContent?.querySelector('#unitResearchDetail');if(!detail)return;
 const selected=modalContent.querySelector('.unit-card.chosen');if(!selected)return;const state=researchStates[selected.dataset.unit];if(!state)return;
 const item=[...infantryUnits,...heavyAircraft].find(x=>x.id===selected.dataset.unit);if(!item)return;
 const remaining=Math.max(0,(state.endAt-Date.now())/1000);const progress=state.done?100:Math.min(100,(1-remaining/item.duration)*100);
 const bar=detail.querySelector('#selectedResearchProgress'),time=detail.querySelector('#selectedResearchTime'),btn=detail.querySelector('#startSelectedResearch');if(bar)bar.style.width=`${progress}%`;if(time)time.textContent=state.done?'اكتمل البحث':`الوقت المتبقي: ${formatResearchTime(remaining)}`;if(btn&&state.done){btn.disabled=true;btn.textContent='تم إكمال البحث'}
 const small=selected.querySelector('small');if(small)small.textContent=state.done?'بحث مكتمل':'جارٍ البحث';
},1000);
const tabs={state:statePanel,diplomacy:diplomacyPanel,trade:tradePanel,research:researchPanel};
document.querySelectorAll('.bottom-nav button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.toggle('active',x===b));tabs[b.dataset.tab]?.()}));
// اختيار المحافظة أو المدينة يغيّر التحديد البصري فقط، دون فتح أي نافذة أو بطاقة معلومات.
selectProvince=function(feature,path){document.querySelectorAll('.province').forEach(p=>p.classList.remove('selected'));document.querySelectorAll('.city-marker').forEach(c=>c.classList.remove('selected'));path.classList.add('selected')};
selectCity=function(c){document.querySelectorAll('.city-marker').forEach(marker=>marker.classList.remove('selected'));document.querySelectorAll('.province').forEach(p=>p.classList.remove('selected'));const marker=svg.querySelector(`[data-city="${c.id}"]`);if(marker)marker.classList.add('selected')};
