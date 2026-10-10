# 🚴 RideCluj — Real-Time Cycling Community App

> A mobile application that connects cyclists in Cluj-Napoca through real-time group ride coordination, hazard alerts, and community-driven route sharing.

**Course:** Programare pentru Dispozitive Mobile (PDM)
**Student:** Biriș Bogdan
**University:** Universitatea Babeș-Bolyai, Cluj-Napoca

---

## 📋 Table of Contents

- [Overview](#overview)
- [Core Features](#core-features)
- [Architecture & Rubric Mapping](#architecture--rubric-mapping)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)

---

## Overview

RideCluj is a cycling companion app designed for the Cluj-Napoca community. It enables riders to discover active group rides, join convoys in real-time, and receive push notifications about road hazards — all from their mobile device.

The app is built with **React Native (Expo)** on the frontend, **Node.js (Express)** on the backend, and uses **PostgreSQL** for persistence.

---

## Core Features

### 🏔️ MTB Trail Mode
- Browse a curated catalog of mountain-bike trails around Cluj (Faget, Hoia, etc.).
- View trail difficulty ratings, elevation profiles, and community photos.
- See which trails have active group rides happening right now.

### 🛣️ Road Convoy Tracking
- Create or join real-time group rides on road routes.
- Track convoy position and estimated arrival via live GPS updates.
- Receive **instant hazard alerts** (potholes, dogs, weather) pushed by other riders.

### 🏙️ City Commuter Mode
- Plan daily commute routes optimized for bike lanes and safety.
- Log ride statistics (distance, duration, calories).
- Earn community badges for consecutive commuting streaks.

---

## Architecture & Rubric Mapping

This project is structured to satisfy four specific deliverables required by the university rubric. The table below maps each requirement to its concrete implementation.

| # | Rubric Requirement | Implementation in RideCluj |
|---|---|---|
| **1** | **Define features in a README** | This document (`README.md`) — describes MTB Trail Mode, Road Convoy Tracking, and City Commuter Mode with full feature breakdowns. |
| **2** | **Master-Detail UI** | A **React Navigation Native Stack** with two screens: `RideListScreen` (Master — displays a `FlatList` of active group rides) and `RideDetailScreen` (Detail — shows full information for a selected ride). Tapping an item in the list navigates to the detail view. |
| **3** | **REST service to fetch data** | The backend exposes a `GET /api/rides` endpoint that returns a JSON array of active group rides. The Master screen calls this endpoint using `fetch()` inside a `useEffect` hook. |
| **4** | **WebSocket server-side notifications** | The backend runs a **Socket.io** server that periodically emits `NEW_HAZARD_ALERT` events. The Detail screen connects via `socket.io-client` and displays a React Native `Alert` when a hazard notification arrives. |

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      BACKEND (Express)                  │
│                                                         │
│   GET /api/rides ──────────────► JSON Array of Rides    │
│                                    (REST - Rubric #3)   │
│                                                         │
│   Socket.io Server ────────────► NEW_HAZARD_ALERT       │
│     (emits every 15s)              (WebSocket - Rubric  │
│                                     #4)                 │
└────────────────────────┬────────────────────────────────┘
                         │
              HTTP + WebSocket
                         │
┌────────────────────────▼────────────────────────────────┐
│                   FRONTEND (Expo / React Native)        │
│                                                         │
│   RideListScreen (Master) ◄──── fetch('/api/rides')     │
│        │                                                │
│        │ onPress(ride)                                  │
│        ▼                                                │
│   RideDetailScreen (Detail) ◄── socket.on('NEW_HAZARD  │
│                                  _ALERT')               │
│                                                         │
│   Navigation: React Navigation Native Stack             │
│                (Master-Detail - Rubric #2)               │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | React Native (Expo SDK) | ~52 |
| Navigation | React Navigation (Native Stack) | 7.x |
| Backend | Node.js + Express | 18.x / 4.x |
| Real-time | Socket.io | 4.x |
| Database | PostgreSQL | 16.x |
| Language | TypeScript | 5.x |

---

## Project Structure

```
PDM_Proiect/
├── README.md                   # Feature definitions (Rubric #1)
├── server/                     # Backend
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── server.ts           # Express + Socket.io (Rubric #3 & #4)
└── client/                     # Frontend (Expo)
    ├── package.json
    ├── tsconfig.json
    ├── app.json
    ├── App.tsx                 # Navigation setup (Rubric #2)
    └── screens/
        ├── RideListScreen.tsx  # Master screen — REST fetch (Rubric #3)
        └── RideDetailScreen.tsx# Detail screen — WebSocket (Rubric #4)
```

---

## Getting Started

### Prerequisites
- Node.js ≥ 18
- npm or yarn
- Expo Go app on your mobile device

### 1. Start the Backend
```bash
cd server
npm install
npm run dev
```
The server starts on `http://localhost:3000`.

### 2. Start the Frontend
```bash
cd client
npm install
npx expo start
```
Scan the QR code with Expo Go to launch the app on your device.

> **Note:** Update the `API_BASE_URL` in the client code to match your machine's local network IP (e.g., `http://192.168.1.x:3000`) so the mobile device can reach the backend.

---

## License

This project is developed for academic purposes as part of the PDM course at UBB Cluj-Napoca.
