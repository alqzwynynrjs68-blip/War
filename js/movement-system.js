/* WORLD DOMINION - geographic province movement network */
(function(){'use strict';
const rad=v=>v*Math.PI/180;
function distance(a,b){const R=6371,dLat=rad(b[1]-a[1]),dLon=rad(b[0]-a[0]),q=Math.sin(dLat/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(Math.max(0,Math.min(1,q))));}
// Great-circle interpolation keeps the soldier's travelled distance geographic
// instead of linearly interpolating projected map pixels.
function interpolate(a,b,t){
 t=Math.max(0,Math.min(1,t));const toVec=p=>{const la=rad(p[1]),lo=rad(p[0]),c=Math.cos(la);return[c*Math.cos(lo),c*Math.sin(lo),Math.sin(la)];};
 const A=toVec(a),B=toVec(b),dot=Math.max(-1,Math.min(1,A[0]*B[0]+A[1]*B[1]+A[2]*B[2])),omega=Math.acos(dot);
 if(omega<1e-10)return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 const sin=Math.sin(omega),wa=Math.sin((1-t)*omega)/sin,wb=Math.sin(t*omega)/sin;
 const x=wa*A[0]+wb*B[0],y=wa*A[1]+wb*B[1],z=wa*A[2]+wb*B[2];
 return[Math.atan2(y,x)*180/Math.PI,Math.atan2(z,Math.hypot(x,y))*180/Math.PI];
}
function routeDistance(points){let total=0;for(let i=1;i<(points||[]).length;i++)total+=distance(points[i-1],points[i]);return total;}
function pointInRing(point,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if(((a[1]>point[1])!==(b[1]>point[1]))&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function pointInPolygon(point,poly){return !!poly?.length&&pointInRing(point,poly[0])&&!poly.slice(1).some(r=>pointInRing(point,r));}
function ringCentroid(ring){let area=0,cx=0,cy=0;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const cross=ring[j][0]*ring[i][1]-ring[i][0]*ring[j][1];area+=cross;cx+=(ring[j][0]+ring[i][0])*cross;cy+=(ring[j][1]+ring[i][1])*cross;}if(Math.abs(area)<1e-12)return null;return[cx/(3*area),cy/(3*area)];}
function center(feature){
 const g=feature.geometry,polys=g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:[];
 if(!polys.length)return[0,0];
 // Use the centroid of the largest exterior polygon when it lies inside the province.
 let largest=null,largestArea=-1,best=null;
 for(const poly of polys){const ring=poly?.[0];if(!ring?.length)continue;let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of ring){minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);}const area=Math.abs((maxX-minX)*(maxY-minY));if(area>largestArea){largestArea=area;largest=poly;best={minX,minY,maxX,maxY};}}
 if(!largest)return[0,0];const centroid=ringCentroid(largest[0]);if(centroid&&pointInPolygon(centroid,largest))return centroid;
 // Concave provinces can have an exterior centroid; find a valid interior point.
 const box=best;let candidate=null,bestClearance=-1;for(let gy=1;gy<20;gy++)for(let gx=1;gx<20;gx++){const p=[box.minX+(box.maxX-box.minX)*gx/20,box.minY+(box.maxY-box.minY)*gy/20];if(!pointInPolygon(p,largest))continue;let clearance=Infinity;for(const r of largest){for(let i=1;i<r.length;i++){const a=r[i-1],b=r[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);clearance=Math.min(clearance,d);}}if(clearance>bestClearance){bestClearance=clearance;candidate=p;}}
 return candidate||centroid||[(box.minX+box.maxX)/2,(box.minY+box.maxY)/2];
}
function segments(feature){const out=[],g=feature.geometry;if(!g)return out;const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];polys.forEach(poly=>(poly||[]).forEach(ring=>{for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];const key=p=>Number(p[0]).toFixed(5)+','+Number(p[1]).toFixed(5);let ka=key(a),kb=key(b);out.push({key:ka<kb?ka+'|'+kb:kb+'|'+ka,a,b});}}));return out;}
function build(features,countryFeatures){
 const nodes=new Map(),edges=new Map(),nodesByCountry=new Map();
 (features||[]).forEach((f,i)=>{
  if(!f.geometry)return;const id='p'+i,country=f.properties?.shapeGroup;
  const node={id,feature:f,center:center(f),neighbors:new Map(),boundaryPoints:[]};nodes.set(id,node);
  if(country){if(!nodesByCountry.has(country))nodesByCountry.set(country,[]);nodesByCountry.get(country).push(node);}
  segments(f).forEach(s=>{if(!edges.has(s.key))edges.set(s.key,[]);edges.get(s.key).push({id,...s});});
 });
 // First connect provinces whose shared boundary segments match exactly.
 edges.forEach(items=>{if(items.length<2)return;for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
  const a=nodes.get(items[i].id),b=nodes.get(items[j].id);if(!a||!b||a===b)continue;
  const s=items[i],mid=[(s.a[0]+s.b[0])/2,(s.a[1]+s.b[1])/2];
  a.neighbors.set(b.id,mid);b.neighbors.set(a.id,mid);a.boundaryPoints.push(mid);b.boundaryPoints.push(mid);
 }});
 // Country outlines can preserve a border that was digitized differently in
 // the two countries' ADM1 datasets. Use the shared national border as a
 // bridge between the closest administrative regions on each side.
 const countryEdges=new Map();
 (countryFeatures||[]).forEach(f=>{
  const country=f.properties?.iso_a3;if(!country||!f.geometry)return;
  segments(f).forEach(s=>{if(!countryEdges.has(s.key))countryEdges.set(s.key,[]);countryEdges.get(s.key).push({country,a:s.a,b:s.b});});
 });
 const borders=new Map();
 countryEdges.forEach(items=>{
  const ids=[...new Set(items.map(x=>x.country))];if(ids.length<2)return;
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
   const pair=[ids[i],ids[j]].sort(),key=pair.join('|');if(!borders.has(key))borders.set(key,{a:pair[0],b:pair[1],points:[]});
   items.filter(x=>x.country===pair[0]||x.country===pair[1]).forEach(x=>borders.get(key).points.push([(x.a[0]+x.b[0])/2,(x.a[1]+x.b[1])/2]));
  }
 });
 // The legacy Iraqi/Turkish and Iraqi/Syrian outlines meet at multiple
 // boundary points, but their independently sourced ADM1/country lines do not
 // share matching segments. Keep those real land links traversable as well.
 [['IRQ','TUR'],['IRQ','SYR']].forEach(pair=>{
  const key=pair.slice().sort().join('|');
  if(!borders.has(key))borders.set(key,{a:pair.slice().sort()[0],b:pair.slice().sort()[1],points:[]});
 });
 borders.forEach(border=>{
  const left=nodesByCountry.get(border.a),right=nodesByCountry.get(border.b);if(!left?.length||!right?.length)return;
  // Existing ADM1 shared edges are more precise; only add a bridge if absent.
  if(left.some(a=>right.some(b=>a.neighbors.has(b.id))))return;
  let best=null,bestDistance=Infinity;
  for(const a of left)for(const b of right){const d=distance(a.center,b.center);if(d<bestDistance){bestDistance=d;best={a,b};}}
  if(!best)return;
  let crossing=border.points[0]||[(best.a.center[0]+best.b.center[0])/2,(best.a.center[1]+best.b.center[1])/2],bestCost=Infinity;
  border.points.forEach(p=>{const cost=distance(best.a.center,p)+distance(p,best.b.center);if(cost<bestCost){bestCost=cost;crossing=p;}});
  best.a.neighbors.set(best.b.id,crossing);best.b.neighbors.set(best.a.id,crossing);
  best.a.boundaryPoints.push(crossing);best.b.boundaryPoints.push(crossing);
 });
 nodes.forEach(n=>{n.connected=n.neighbors.size>0;});return nodes;
}
function route(graph,start,goal,opts={}){if(!graph.has(start)||!graph.has(goal))return null;if(opts.blocked&&(opts.blocked(graph.get(start).feature)||opts.blocked(graph.get(goal).feature)))return null;const open=[start],came=new Map(),cost=new Map([[start,0]]),closed=new Set();while(open.length){open.sort((a,b)=>(cost.get(a)+distance(graph.get(a).center,graph.get(goal).center))-(cost.get(b)+distance(graph.get(b).center,graph.get(goal).center)));const cur=open.shift();if(closed.has(cur))continue;if(cur===goal){const path=[cur];let n=cur;while(came.has(n)){n=came.get(n);path.unshift(n);}return path;}closed.add(cur);for(const [next] of graph.get(cur).neighbors){const nextNode=graph.get(next);if(!nextNode||closed.has(next)||(opts.blocked&&opts.blocked(nextNode.feature)))continue;const alt=cost.get(cur)+distance(graph.get(cur).center,nextNode.center);if(alt<(cost.get(next)??Infinity)){cost.set(next,alt);came.set(next,cur);if(!open.includes(next))open.push(next);}}}return null;}
function stats(graph){let connected=0,excluded=0;graph.forEach(n=>n.connected?connected++:excluded++);return{total:graph.size,connected,excluded};}
window.WD_MOVEMENT={build,route,distance,interpolate,routeDistance,center,stats};})();
