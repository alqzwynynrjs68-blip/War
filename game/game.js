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
function selectProvince(feature,path){document.querySelectorAll('.province').forEach(p=>p.classList.remove('selected'));path.classList.add('selected');let name=feature.properties.name_ar||names[feature.properties.shapeISO];let city=cities.find(c=>c.province===name);$('#details').innerHTML=`<div class="eyebrow">المحافظة المحددة</div><h3>${name}</h3><div class="detail-stat"><span>الدولة</span><b>العراق</b></div><div class="detail-stat"><span>المركز الحضري</span><b>${city?city.name:'غير محدد في المدن الرئيسية'}</b></div><div class="detail-stat"><span>الحدود</span><b>حدود محافظة</b></div><p>هذه محافظة من المحافظات العراقية الـ18، ويمكن تخصيصها لاحقاً ضمن نظام السيطرة والقتال.</p>`}
function selectCity(c){$('#details').innerHTML=`<div class="eyebrow">${c.capital?'عاصمة الدولة':'مدينة رئيسية'}</div><h3>${c.name}</h3><div class="detail-stat"><span>المحافظة</span><b>${c.province}</b></div><div class="detail-stat"><span>الموقع</span><b>العراق</b></div><div class="detail-stat"><span>النوع</span><b>${c.capital?'عاصمة':'مدينة'}</b></div><p>مركز عمراني مرسوم داخل الخريطة. ستُستخدم المدن لاحقاً كمراكز للتجنيد والإمداد والسيطرة.</p>`}
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
