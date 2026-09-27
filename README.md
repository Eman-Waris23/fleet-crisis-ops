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


Alert System

The prototype includes several types of operational alerts.

Geofence Alerts

Ships entering restricted zones can generate geofence alerts.

The challenge specifies a 1-second alert target for geofence monitoring.

Proximity Alerts

The system monitors the distance between ships and generates warnings when ships approach within approximately:

2 km
Weather Alerts

Adverse weather conditions can trigger operational warnings and affect fuel consumption.

Fuel Alerts

The system monitors fuel conditions and applies the challenge-defined adverse-weather fuel penalty.

Weather-Aware Routing

The application uses weather information to help determine operational routing.

The server attempts to retrieve weather information from the Open-Meteo Weather API.

No API key is required.

If the external weather service is unavailable, the application automatically falls back to deterministic simulated weather.

This keeps the prototype runnable even when internet access is unavailable.

Distress & AI/NLP Processing

The Captain can submit a free-form distress message.

The system analyzes the message and extracts useful operational information.

The current prototype uses a local deterministic keyword/rule-based parser rather than an external AI service.

The parser extracts information such as:

Severity
Issue type
Injury count
Damage estimate
Quantified impact text

The main parsing logic is implemented through:

parseDistress()

in:

server.js

For a production version, this component could be replaced with an LLM or dedicated NLP service.

Challenge Requirements Implemented

The prototype implements the core behaviors described in the supplied challenge.

Requirement	Implementation
15 active ships	Yes
1 Hz state updates	Yes
WebSocket synchronization	Yes
Fast state propagation	Implemented for prototype
Geofence alerts	Yes
2 km proximity warnings	Yes
Adverse-weather fuel penalty	Yes
Route avoidance	Yes
Captain role	Yes
Command role	Yes
Distress NLP	Yes
Weather-aware routing	Yes
Playback history	Yes
Restricted zones	Yes
Ship directives	Yes
Project Structure
fleet-crisis-ops/
│
├── data/
│   └── fleet.json
│
├── public/
│   ├── index.html
│   ├── app.js
│   └── styles.css
│
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── package.json
├── package-lock.json
├── README.md
└── server.js
