# Fleet Crisis Ops — Code Rush Web Dev Track

A runnable end-to-end prototype for the supplied "Strait of Hormuz Crisis" challenge.

## Stack
- Node.js + Express
- WebSocket (`ws`) for 1 Hz live state sync
- Leaflet for the interactive map
- Vanilla HTML/CSS/JS frontend
- Docker Compose
- Open-Meteo weather API (optional; app falls back to simulated weather if unavailable)

## Run locally

```bash
npm install
npm start
```

Open http://localhost:3000

## Run with Docker

```bash
docker compose up --build
```

Open http://localhost:3000

## Interfaces

- `/` — Command interface
- `/?role=captain&ship=MV-1` — Captain interface for one ship
- `/?role=captain&ship=MV-2` — change the captain's ship

The Command interface can:
- See all 15 ships
- Draw polygon restricted zones
- Send directives to ships
- Acknowledge/resolve alerts
- Inspect ship details
- View playback history
- See proximity, geofence, fuel and weather alerts

Captain interface can:
- See its own ship and command zones
- Accept directives
- Escalate distress with a free-form message
- See AI-extracted severity, issue and impact

## Challenge alignment

The supplied challenge specifies exactly 15 active ships, 1 Hz state updates, WebSocket synchronization, 500 ms target state propagation, 1-second geofence alerts, 2 km proximity warnings, 30% adverse-weather fuel penalty, route avoidance, captain/command roles, distress NLP, weather-aware routing and 30-second playback history. This prototype implements those core behaviors with a deliberately simple routing/grid-free simulation suitable for an 8-hour hackathon.

Source scenario data is taken from the provided `fleet.pdf` and challenge requirements from `lab3_hackhathon.pdf`.

## Weather

The server requests Open-Meteo when possible. No API key is required. If network access is unavailable, deterministic simulated weather is used so the demo remains runnable.

## AI/NLP note

The distress parser is local and deterministic (keyword/rule extraction), so the project has no external AI key dependency. It extracts:
- severity
- issue
- injury count
- damage estimate
- quantified impact text

For a production version, replace `parseDistress()` in `server.js` with an LLM/NLP provider.

## Assumptions

1. The provided simplified navigable-water polygon is treated as the operational water corridor.
2. Routing uses waypoint deflection rather than a full maritime routing engine.
3. The challenge's fixed 15-ship fleet is loaded from `data/fleet.json`.
4. Browser map tiles use OpenStreetMap/Leaflet CDN during development; an offline tile provider can be substituted for judging if required.



