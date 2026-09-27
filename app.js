let state={fleet:[],zones:[],alerts:[],history:[],tick:0};
let map, markers=new Map(), zoneLayers=new Map(), drawing=false, drawPoints=[], drawLine=null;
const params=new URLSearchParams(location.search);
let role=params.get("role")==="captain"?"captain":"command";
let captainShip=params.get("ship")||"MV-1";

const $=id=>document.getElementById(id);
const portsCache=[];

function initMap(){
  map=L.map("map").setView([26,55.5],6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"© OpenStreetMap"}).addTo(map);
  map.on("click",e=>{
    if(!drawing)return;
    drawPoints.push([e.latlng.lat,e.latlng.lng]);
    if(drawLine)map.removeLayer(drawLine);
    drawLine=L.polyline(drawPoints,{color:"#ff5267",weight:3,dashArray:"5 5"}).addTo(map);
  });
}

function icon(status){
  const color=status==="distressed"||status==="out of fuel"?"#ff5267":status==="rerouting"?"#ffca5f":"#42e7aa";
  return L.divIcon({className:"shipIcon",html:`<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 10px ${color}"></div>`,iconSize:[12,12],iconAnchor:[6,6]});
}

function render(){
  $("tick").textContent=state.tick;
  $("shipCount").textContent=state.fleet.length;
  $("roleLabel").textContent=role.toUpperCase();
  $("commandPanel").classList.toggle("hidden",role==="captain");
  document.querySelectorAll(".commandOnly").forEach(x=>x.classList.toggle("hidden",role==="captain"));
  $("captainPanel").classList.toggle("hidden",role!=="captain");
  renderMarkers(); renderZones(); renderFleetList(); renderSelectors(); renderAlerts();
  if(role==="captain")renderCaptain();
}

function renderMarkers(){
  const live=new Set();
  state.fleet.forEach(s=>{
    live.add(s.shipId);
    if(!markers.has(s.shipId)){
      const m=L.marker(s.position,{icon:icon(s.status)}).addTo(map);
      m.on("click",()=>showShip(s.shipId));
      markers.set(s.shipId,m);
    }
    const m=markers.get(s.shipId);
    m.setLatLng(s.position).setIcon(icon(s.status));
    m.bindTooltip(`${s.name} • ${s.status}`,{direction:"top"});
  });
  for(const [id,m] of markers)if(!live.has(id)){map.removeLayer(m);markers.delete(id)}
}

function renderZones(){
  const live=new Set();
  state.zones.forEach(z=>{
    live.add(z.id);
    if(!zoneLayers.has(z.id)){
      const layer=L.polygon(z.polygon,{color:"#ff5267",fillColor:"#ff5267",fillOpacity:.18,weight:2}).addTo(map);
      layer.bindTooltip(z.name);
      zoneLayers.set(z.id,layer);
    } else zoneLayers.get(z.id).setLatLngs(z.polygon);
  });
  for(const [id,l] of zoneLayers)if(!live.has(id)){map.removeLayer(l);zoneLayers.delete(id)}
}

function renderFleetList(){
  const el=$("fleetList"); if(role==="captain")return;
  el.innerHTML=state.fleet.map(s=>`<div class="shipRow" onclick="showShip('${s.shipId}')">
    <div><div class="shipName">${s.shipId} — ${s.name}</div><div class="shipMeta">${s.cargo} · ${s.speed} kn · ${s.destination}</div></div>
    <span class="status ${s.status.replaceAll(" ","-")}">${s.status}</span></div>`).join("");
}

function renderSelectors(){
  $("directiveShip").innerHTML=state.fleet.map(s=>`<option value="${s.shipId}">${s.shipId} — ${s.name}</option>`).join("");
  $("captainShip").innerHTML=state.fleet.map(s=>`<option value="${s.shipId}">${s.shipId} — ${s.name}</option>`).join("");
  $("captainShip").value=captainShip;
  const portOptions=window.ports?.map(p=>`<option value="${p.id}">${p.name}</option>`).join("")||"";
  $("directivePort").innerHTML=portOptions;
}

function renderCaptain(){
  const s=state.fleet.find(x=>x.shipId===captainShip); if(!s)return;
  $("captainDetails").innerHTML=`<div class="metricGrid">
    <div class="metric"><small>STATUS</small><b>${s.status}</b></div>
    <div class="metric"><small>FUEL</small><b>${Math.round(s.fuel)} t</b></div>
    <div class="metric"><small>SPEED</small><b>${s.speed} kn</b></div>
    <div class="metric"><small>DESTINATION</small><b>${s.destination}</b></div>
  </div>`;
  const d=state.directives?.find(x=>x.shipId===captainShip&&x.status==="PENDING_CAPTAIN");
  $("pendingDirective").innerHTML=d?`<div class="card"><b>NEW COMMAND DIRECTIVE</b><p>${d.type} ${d.value||""}</p><button onclick="respond('${d.id}','ACCEPT')">ACCEPT</button><button class="dangerBtn" onclick="escalate('${d.id}')">ESCALATE DISTRESS</button></div>`:"";
}

function renderAlerts(){
  const active=state.alerts.filter(a=>a.active).slice().reverse();
  $("alertCount").textContent=active.length;
  $("alerts").innerHTML=active.length?active.map(a=>`<div class="alert ${a.severity}">
    <b>${a.type.toUpperCase()}</b> — ${a.message}<br><small>${new Date(a.createdAt).toLocaleTimeString()}</small>
    ${role==="command"?`<br><button onclick="resolveAlert('${a.id}')">ACKNOWLEDGE</button>`:""}
  </div>`).join(""):"<div class='muted'>No active alerts.</div>";
}

function showShip(id){
  const s=state.fleet.find(x=>x.shipId===id); if(!s)return;
  $("modalContent").innerHTML=`<h2>${s.name} <small>${s.shipId}</small></h2>
  <div class="metricGrid">
    <div class="metric"><small>CARGO</small><b>${s.cargo}</b></div>
    <div class="metric"><small>STATUS</small><b>${s.status}</b></div>
    <div class="metric"><small>FUEL</small><b>${Math.round(s.fuel)} tons</b></div>
    <div class="metric"><small>SPEED</small><b>${s.speed} knots</b></div>
    <div class="metric"><small>HEADING</small><b>${Math.round(s.heading)}°</b></div>
    <div class="metric"><small>DESTINATION</small><b>${s.destination}</b></div>
    <div class="metric"><small>WEATHER</small><b>${s.weather?.wind||0} wind</b></div>
    <div class="metric"><small>FUEL TO DEST.</small><b>${s.estimatedFuelToDestination||0} t</b></div>
  </div>`;
  $("shipModal").classList.remove("hidden");
}

function respond(id,response){
  fetch(`/api/directives/${id}/respond`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({response})});
}
function escalate(id){
  const msg=prompt("Enter distress message:");
  if(msg)fetch(`/api/directives/${id}/respond`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({response:"ESCALATE_DISTRESS",distressMessage:msg})});
}
function resolveAlert(id){fetch(`/api/alerts/${id}/resolve`,{method:"POST"})}

$("closeModal").onclick=()=>$("shipModal").classList.add("hidden");
$("switchRole").onclick=()=>{location.href=role==="command"?"/?role=captain&ship=MV-1":"/"};
$("captainShip").onchange=e=>{captainShip=e.target.value;renderCaptain()};
$("sendDirective").onclick=()=>{
  const type=$("directiveType").value;
  let value=type==="PORT"?$("directivePort").value:type==="WAYPOINT"?[26.0,56.0]:null;
  fetch("/api/directives",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({shipId:$("directiveShip").value,type,value})});
};
$("distressBtn").onclick=()=>{
  const text=$("distressText").value.trim(); if(!text)return;
  const s=state.fleet.find(x=>x.shipId===captainShip);
  const msg={type:"local-distress",text,shipId:s.shipId};
  // Use a synthetic directive so the same server-side NLP path handles it.
  fetch("/api/directives",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({shipId:s.shipId,type:"DISTRESS",value:null})})
    .then(r=>r.json()).then(d=>fetch(`/api/directives/${d.id}/respond`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({response:"ESCALATE_DISTRESS",distressMessage:text})}));
  $("distressText").value="";
};

$("drawZone").onclick=()=>{
  if(role!=="command")return;
  drawing=true;drawPoints=[];if(drawLine){map.removeLayer(drawLine);drawLine=null}
  $("drawZone").textContent="CLICK MAP POINTS • FINISH";
  $("drawZone").onclick=finishZone;
};
function finishZone(){
  if(drawPoints.length<3){alert("Choose at least 3 points.");return}
  const name=prompt("Zone name:","Restricted Zone");
  fetch("/api/zones",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,polygon:drawPoints})});
  drawing=false;drawPoints=[];if(drawLine){map.removeLayer(drawLine);drawLine=null}
  $("drawZone").textContent="DRAW ZONE";$("drawZone").onclick=()=>{drawing=true;drawPoints=[];$("drawZone").textContent="CLICK MAP POINTS • FINISH";$("drawZone").onclick=finishZone};
}
$("clearZone").onclick=()=>{drawing=false;drawPoints=[];if(drawLine){map.removeLayer(drawLine);drawLine=null}};

function connect(){
  const proto=location.protocol==="https:"?"wss":"ws";
  const ws=new WebSocket(`${proto}://${location.host}`);
  ws.onopen=()=>{$("liveDot").style.color="#31e6a1"};
  ws.onclose=()=>{$("liveDot").style.color="#ff5267";setTimeout(connect,1000)};
  ws.onmessage=e=>{
    const msg=JSON.parse(e.data);
    if(msg.type==="state"){state={...state,...msg};render()}
    if(msg.type==="zones"){state.zones=msg.zones;renderZones()}
    if(msg.type==="alert"){state.alerts.push(msg.alert);renderAlerts()}
    if(msg.type==="alerts"){state.alerts=msg.alerts;renderAlerts()}
    if(msg.type==="directive"){state.directives=[...(state.directives||[]),msg.directive];render()}
    if(msg.type==="directive-response"){state.directives=(state.directives||[]).filter(x=>x.id!==msg.directive.id);render()}
  };
}

async function boot(){
  initMap();
  const r=await fetch("/api/config"); const cfg=await r.json();
  state=cfg;window.ports=cfg.ports;
  $("captainShip").value=captainShip;
  render();connect();
}
boot();
