# Fleet Crisis Ops

Real-Time Crisis Fleet Command and Operations System

## Overview

Fleet Crisis Ops is a real-time web-based command system designed to monitor and manage a fleet of commercial ships operating in a high-risk maritime environment.

The system provides live ship tracking, command and captain interfaces, WebSocket-based synchronization, restricted-zone monitoring, geofence alerts, proximity warnings, weather-aware fuel monitoring, rerouting, and AI-assisted distress analysis.

## Problem

During a maritime crisis, fleet operators need to continuously monitor ships, communicate with captains, identify dangerous situations, and respond quickly to changing conditions.

Fleet Crisis Ops provides a centralized interface for monitoring and controlling the fleet in real time.

## Key Features

- Real-time tracking of 15 ships
- Interactive maritime map
- WebSocket-based live synchronization
- Command interface
- Captain interface
- Restricted-zone creation
- Geofence breach alerts
- 2 km ship proximity warnings
- Ship rerouting
- Port and waypoint directives
- Captain ACCEPT / ESCALATE_DISTRESS responses
- AI-assisted distress message analysis
- Severity detection
- Injury and damage extraction
- Weather monitoring
- 30% adverse-weather fuel penalty
- Fuel sufficiency monitoring
- Operational status tracking
- Fleet playback/history
- Docker support
- Responsive interface

## Technology Stack

### Frontend

- HTML5
- CSS3
- JavaScript
- Leaflet.js

### Backend

- Node.js
- Express.js
- WebSocket
- ws

### Infrastructure

- Docker
- Docker Compose

### Data

- JSON fleet configuration
- Open-Meteo weather service
- WebSocket live state updates

## System Architecture

```text
                ┌──────────────────────┐
                │      Command UI      │
                └──────────┬───────────┘
                           │
                           │ WebSocket
                           │
                ┌──────────▼───────────┐
                │    Node.js Server    │
                │                      │
                │ Fleet Simulation     │
                │ Routing              │
                │ Alerts               │
                │ Geofencing           │
                │ Weather              │
                │ Distress NLP         │
                └──────────┬───────────┘
                           │
                           │ WebSocket
                           │
                ┌──────────▼───────────┐
                │     Captain UI       │
                └──────────────────────┘
