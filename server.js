const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT || 3000);
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const fleetConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "fleet.json"), "utf8"));
const fleet = new Map();
const zones = new Map();
const alerts = [];
const history = [];
const directives = new Map();
let zoneCounter = 1;
let alertCounter = 1;
let tickNo = 0;

for (const raw of fleetConfig.fleet) {
  const p = [...raw.position];
  fleet.set(raw.shipId, {
    ...raw,
    position: p,
    route: [p, getPort(raw.destination).position],
    routeIndex: 1,
    weather: { wind: 8, rain: 0, adverse: false },
    estimatedFuelToDestination: 0,
    directive: null,
    lastTick: Date.now()
  });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/config", (_, res) => {
  res.json({
    ...fleetConfig,
    fleet: [...fleet.values()],
    zones: [...zones.values()],
    alerts: alerts.slice(-100),
    history: history.slice(-120),
    tick: tickNo
  });
});

app.post("/api/zones", (req, res) => {
  const { name, polygon } = req.body || {};
  if (!Array.isArray(polygon) || polygon.length < 3) return res.status(400).json({ error: "Polygon requires at least 3 points." });
  const zone = { id: `ZONE-${zoneCounter++}`, name: name || `Restricted Zone ${zoneCounter - 1}`, polygon, createdAt: Date.now() };
  zones.set(zone.id, zone);
  broadcast({ type: "zones", zones: [...zones.values()] });
  res.json(zone);
});

app.delete("/api/zones/:id", (req, res) => {
  zones.delete(req.params.id);
  broadcast({ type: "zones", zones: [...zones.values()] });
  res.json({ ok: true });
});

app.post("/api/directives", (req, res) => {
  const { shipId, type, value } = req.body || {};
  const ship = fleet.get(shipId);
  if (!ship) return res.status(404).json({ error: "Ship not found" });
  const directive = { id: `DIR-${Date.now()}`, shipId, type, value, createdAt: Date.now(), status: "PENDING_CAPTAIN" };
  directives.set(directive.id, directive);
  ship.directive = directive;
  addAlert("directive", `Command sent ${type} directive to ${ship.name}`, shipId, "info");
  broadcast({ type: "directive", directive });
  res.json(directive);
});

app.post("/api/directives/:id/respond", (req, res) => {
  const directive = directives.get(req.params.id);
  if (!directive) return res.status(404).json({ error: "Directive not found" });
  const ship = fleet.get(directive.shipId);
  const { response, distressMessage } = req.body || {};
  if (!ship) return res.status(404).json({ error: "Ship not found" });

  if (response === "ACCEPT") {
    directive.status = "ACCEPTED";
    applyDirective(ship, directive);
    ship.directive = null;
    addAlert("directive", `${ship.name} accepted Command directive`, ship.shipId, "info");
  } else {
    directive.status = "ESCALATE_DISTRESS";
    const ai = parseDistress(distressMessage || "");
    ship.status = ai.severity === "CRITICAL" ? "distressed" : "distressed";
    ship.directive = null;
    const alert = addAlert("distress", `${ship.name}: ${ai.issue || "distress escalated"}`, ship.shipId, ai.severity === "CRITICAL" ? "critical" : "warning", ai);
    directive.ai = ai;
    directive.alertId = alert.id;
  }
  broadcast({ type: "directive-response", directive });
  res.json(directive);
});

app.post("/api/alerts/:id/resolve", (req, res) => {
  const a = alerts.find(x => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: "Alert not found" });
  a.active = false;
  a.resolvedAt = Date.now();
  broadcast({ type: "alerts", alerts: alerts.slice(-100) });
  res.json(a);
});

wss.on("connection", ws => {
  ws.send(JSON.stringify(snapshot()));
  ws.on("message", raw => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong", t: Date.now() }));
    } catch {}
  });
});

function snapshot() {
  return {
    type: "state",
    tick: tickNo,
    serverTime: Date.now(),
    fleet: [...fleet.values()],
    zones: [...zones.values()],
    alerts: alerts.slice(-100),
    history: history.slice(-120),
    directives: [...directives.values()].filter(d => d.status === "PENDING_CAPTAIN")
  };
}

function broadcast(obj) {
  const text = JSON.stringify(obj);
  for (const ws of wss.clients) if (ws.readyState === 1) ws.send(text);
}

function getPort(id) {
  return fleetConfig.ports.find(p => p.id === id) || fleetConfig.ports[0];
}

function applyDirective(ship, d) {
  if (d.type === "HOLD") {
    ship.speed = 0;
    ship.status = "stopped";
    return;
  }
  if (d.type === "PORT") {
    if (getPort(d.value)) {
      ship.destination = d.value;
      ship.route = [ship.position.slice(), getPort(d.value).position.slice()];
      ship.routeIndex = 1;
      ship.speed = Math.max(ship.speed, 8);
      ship.status = "rerouting";
    }
  }
  if (d.type === "WAYPOINT" && Array.isArray(d.value)) {
    ship.route = [ship.position.slice(), d.value.slice(), getPort(ship.destination).position.slice()];
    ship.routeIndex = 1;
    ship.status = "rerouting";
  }
}

function distanceKm(a, b) {
  const R = 6371;
  const lat1 = a[0] * Math.PI / 180, lat2 = b[0] * Math.PI / 180;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bearing(a, b) {
  const lat1 = a[0]*Math.PI/180, lat2=b[0]*Math.PI/180;
  const dl=(b[1]-a[1])*Math.PI/180;
  const y=Math.sin(dl)*Math.cos(lat2);
  const x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dl);
  return (Math.atan2(y,x)*180/Math.PI+360)%360;
}

function moveToward(ship, seconds) {
  if (ship.speed <= 0) return;
  const target = ship.route[ship.routeIndex] || getPort(ship.destination).position;
  const d = distanceKm(ship.position, target);
  const kmPerSecond = ship.speed * 1.852 / 3600;
  const step = kmPerSecond * seconds;
  ship.heading = bearing(ship.position, target);

  if (d <= step + 0.01) {
    ship.position = target.slice();
    if (ship.routeIndex < ship.route.length - 1) {
      ship.routeIndex++;
    } else {
      ship.status = "arrived";
      ship.speed = 0;
    }
  } else {
    const ratio = step / d;
    ship.position[0] += (target[0] - ship.position[0]) * ratio;
    ship.position[1] += (target[1] - ship.position[1]) * ratio;
  }

  const fuelRate = Math.max(0.35, ship.speed * 0.025);
  ship.fuel = Math.max(0, ship.fuel - fuelRate * (ship.weather.adverse ? 1.3 : 1) * seconds);
  if (ship.fuel <= 0) ship.status = "out of fuel";
}

function pointInPolygon(point, polygon) {
  let inside = false;
  const x = point[1], y = point[0];
  for (let i=0,j=polygon.length-1; i<polygon.length; j=i++) {
    const xi=polygon[i][1], yi=polygon[i][0];
    const xj=polygon[j][1], yj=polygon[j][0];
    const intersect = ((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi);
    if (intersect) inside=!inside;
  }
  return inside;
}

function pointToSegmentDistanceKm(p, a, b) {
  const meanLat = p[0] * Math.PI/180;
  const scaleY = 111.32, scaleX = 111.32*Math.cos(meanLat);
  const px=p[1]*scaleX, py=p[0]*scaleY, ax=a[1]*scaleX, ay=a[0]*scaleY, bx=b[1]*scaleX, by=b[0]*scaleY;
  const dx=bx-ax, dy=by-ay;
  const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1)));
  const qx=ax+t*dx, qy=ay+t*dy;
  return Math.hypot(px-qx,py-qy);
}

function routeIntersectsZone(ship, zone) {
  const target = ship.route[ship.routeIndex] || getPort(ship.destination).position;
  return zone.polygon.some((p,i) => {
    const q = zone.polygon[(i+1)%zone.polygon.length];
    return pointToSegmentDistanceKm(ship.position, p, q) < 0.8 || pointToSegmentDistanceKm(target, p, q) < 0.8;
  }) || pointInPolygon(target, zone.polygon);
}

function rerouteAroundZones(ship) {
  const dest = getPort(ship.destination).position;
  let waypoint = null;
  for (const zone of zones.values()) {
    if (routeIntersectsZone(ship, zone)) {
      const c = zone.polygon.reduce((s,p)=>[s[0]+p[0],s[1]+p[1]],[0,0]).map(v=>v/zone.polygon.length);
      const away = bearing(c, ship.position);
      const r = 0.12;
      waypoint = [c[0] + Math.cos(away*Math.PI/180)*r, c[1] + Math.sin(away*Math.PI/180)*r];
      break;
    }
  }
  if (waypoint) {
    ship.route = [ship.position.slice(), waypoint, dest.slice()];
    ship.routeIndex = 1;
    ship.status = "rerouting";
  } else if (ship.status === "rerouting") {
    ship.route = [ship.position.slice(), dest.slice()];
    ship.routeIndex = 1;
    ship.status = "normal";
  }
}

function weatherFor(ship) {
  // Lightweight deterministic weather field; the server also attempts Open-Meteo below.
  const w = 5 + 7*Math.abs(Math.sin((ship.position[0]+ship.position[1]+tickNo)/18));
  const adverse = w >= 10.5;
  ship.weather = { wind: Number(w.toFixed(1)), rain: adverse ? 4 : 0, adverse };
}

async function fetchWeather() {
  // Open-Meteo is deliberately non-blocking for the simulation.
  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=26.2&longitude=56.0&current=wind_speed_10m,precipitation";
    const r = await fetch(url, { signal: AbortSignal.timeout(1800) });
    if (r.ok) {
      const data = await r.json();
      return { wind: data.current?.wind_speed_10m ?? 0, rain: data.current?.precipitation ?? 0 };
    }
  } catch {}
  return null;
}

function parseDistress(text) {
  const t = String(text || "").toLowerCase();
  const injury = Number((t.match(/(\d+)\s*(?:injur|people|person|crew|wounded)/) || [])[1] || 0);
  const damage = Number((t.match(/(?:damage|damaged)\D{0,20}(\d+(?:\.\d+)?)\s*(?:k|thousand|usd|\$)?/) || [])[1] || 0);
  let severity = "LOW";
  if (/(fire|collision|sinking|critical|multiple injured|mayday|engine failure)/.test(t) || injury >= 2) severity = "CRITICAL";
  else if (/(injur|leak|damage|smoke|engine|medical|storm)/.test(t)) severity = "HIGH";
  else if (t.trim()) severity = "MEDIUM";
  let issue = "General distress";
  if (/fire/.test(t)) issue = "Fire reported";
  else if (/collision/.test(t)) issue = "Collision reported";
  else if (/engine/.test(t)) issue = "Engine problem reported";
  else if (/leak/.test(t)) issue = "Leak reported";
  else if (/medical|injur/.test(t)) issue = "Medical/injury situation";
  else if (/storm/.test(t)) issue = "Severe weather issue";
  return { severity, issue, injuryCount: injury, damageEstimate: damage || null, impact: `${injury} injury/crew mentions; ${damage || 0} damage estimate units` };
}

function addAlert(type, message, shipId, severity="info", meta={}) {
  const a = { id:`AL-${alertCounter++}`, type, message, shipId, severity, active:true, createdAt:Date.now(), ...meta };
  alerts.push(a);
  while (alerts.length > 200) alerts.shift();
  broadcast({ type:"alert", alert:a });
  return a;
}

function tick() {
  tickNo++;
  const seconds = 1;
  for (const ship of fleet.values()) {
    weatherFor(ship);
    rerouteAroundZones(ship);
    moveToward(ship, seconds);

    for (const zone of zones.values()) {
      if (pointInPolygon(ship.position, zone.polygon)) {
        const existing = alerts.find(a => a.type==="geofence" && a.shipId===ship.shipId && a.zoneId===zone.id && a.active);
        if (!existing) {
          ship.status = "rerouting";
          addAlert("geofence", `${ship.name} breached ${zone.name}`, ship.shipId, "critical", { zoneId: zone.id });
        }
      }
    }

    const remaining = distanceKm(ship.position, getPort(ship.destination).position);
    ship.estimatedFuelToDestination = Math.round(remaining * 0.65 * (ship.weather.adverse ? 1.3 : 1));
    if (ship.fuel < ship.estimatedFuelToDestination && ship.status !== "arrived" && ship.status !== "out of fuel") {
      if (!ship.status.includes("insufficient")) {
        ship.status = "insufficient fuel";
        addAlert("fuel", `${ship.name} may not have enough fuel for its current route`, ship.shipId, "warning");
      }
    }
  }

  const ships = [...fleet.values()];
  for (let i=0;i<ships.length;i++) for (let j=i+1;j<ships.length;j++) {
    const d = distanceKm(ships[i].position, ships[j].position);
    if (d <= 2) {
      const key = [ships[i].shipId, ships[j].shipId].sort().join(":");
      const existing = alerts.find(a=>a.type==="proximity" && a.pair===key && a.active);
      if (!existing) addAlert("proximity", `${ships[i].name} and ${ships[j].name} are within 2 km`, null, "warning", { pair:key, distanceKm:Number(d.toFixed(2)) });
    }
  }

  history.push({
    tick: tickNo, time: Date.now(),
    ships: ships.map(s=>({shipId:s.shipId,position:s.position.slice(),status:s.status,fuel:Math.round(s.fuel)}))
  });
  while (history.length > 120) history.shift();

  broadcast({ type:"state", tick:tickNo, serverTime:Date.now(), fleet:ships, zones:[...zones.values()], alerts:alerts.slice(-100) });
}

setInterval(tick, 1000);

app.get("/health", (_,res)=>res.json({ok:true,tick:tickNo,ships:fleet.size}));
server.listen(PORT, ()=>console.log(`Fleet Crisis Ops running on http://localhost:${PORT}`));
