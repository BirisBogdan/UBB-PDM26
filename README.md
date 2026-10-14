# RideCluj

A mobile app for cyclists in Cluj-Napoca to discover and join group rides.

**Course:** Programare pentru Dispozitive Mobile (PDM)
**Student:** Biris Bogdan
**University:** Universitatea Babes-Bolyai, Cluj-Napoca

## Features

- **Browse group rides**: see all active rides (MTB, Road, Commuter) with route, distance, number of riders and status. Pull down to refresh the list.
- **Ride details**: tap a ride to open its detail screen with the full information.
- **Enroll / unenroll**: join or leave a ride from its detail screen. Enrollments are saved on the server and cached on the phone, so they survive app and server restarts.
- **Live ride updates**: when anyone enrolls in or leaves a ride, the server notifies all connected phones and the rider count updates on every screen without refreshing.

## Rubric Mapping

| # | Requirement | Implementation |
|---|---|---|
| 1 | Define features in README | This document |
| 2 | Master-Detail UI | `RideListScreen` (master list) and `RideDetailScreen` (detail) using React Navigation Native Stack |
| 3 | REST service to fetch data | `GET /api/rides`, `GET /api/rides/:id` and `/api/enrollments` endpoints, called with `fetch()` |
| 4 | WebSocket notifications | Socket.io server pushes a `RIDE_UPDATED` event to all connected clients with `io.emit`; both screens listen and update live |

### WebSocket events

| Event | Direction | Payload | When |
|---|---|---|---|
| `RIDE_UPDATED` | server → all clients | the updated `Ride` | Someone enrolls in or leaves a ride, so its rider count changes |

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

**Note:** Update `API_BASE_URL` in `RideListScreen.tsx` and `SERVER_URL` in `RideDetailScreen.tsx` to your machine's local network IP (e.g. `http://192.168.0.59:8080`).
