# RideCluj

A mobile app for cyclists in Cluj-Napoca to discover group rides and receive real-time hazard alerts.

**Course:** Programare pentru Dispozitive Mobile (PDM)
**Student:** Biris Bogdan
**University:** Universitatea Babes-Bolyai, Cluj-Napoca

## Features

- Browse active group rides (MTB, Road, Commuter)
- View ride details (route, distance, riders, status)
- Receive real-time hazard alerts (potholes, dogs, weather, obstacles, traffic)
- Pull-to-refresh ride list

## Rubric Mapping

| # | Requirement | Implementation |
|---|---|---|
| 1 | Define features in README | This document |
| 2 | Master-Detail UI | `RideListScreen` (list) and `RideDetailScreen` (detail) using React Navigation Native Stack |
| 3 | REST service to fetch data | `GET /api/rides` endpoint called with `fetch()` in `useEffect` |
| 4 | WebSocket notifications | Socket.io server emits `NEW_HAZARD_ALERT` events; detail screen listens and shows alerts |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React Native (Expo SDK 57) |
| Navigation | React Navigation Native Stack 7.x |
| Backend | Node.js + Express |
| Real-time | Socket.io 4.x |
| Language | TypeScript |

## Project Structure

```
PDM_Proiect/
├── README.md
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── server.ts
└── client/
    ├── package.json
    ├── tsconfig.json
    ├── app.json
    ├── App.tsx
    └── screens/
        ├── RideListScreen.tsx
        └── RideDetailScreen.tsx
```

## Getting Started

### Prerequisites
- Node.js >= 18
- Expo Go app on your phone

### 1. Start the Backend
```bash
cd server
npm install
npm run dev
```

### 2. Start the Frontend
```bash
cd client
npm install
npx expo start
```

Scan the QR code with Expo Go.

**Note:** Update `API_BASE_URL` in `RideListScreen.tsx` and `SOCKET_URL` in `RideDetailScreen.tsx` to your machine's local network IP (e.g. `http://192.168.0.59:8080`).
