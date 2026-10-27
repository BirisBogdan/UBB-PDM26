# RideCluj

A mobile app for cyclists in Cluj-Napoca to discover and join group rides.

**Course:** Programare pentru Dispozitive Mobile (PDM)
**Student:** Biris Bogdan
**University:** Universitatea Babes-Bolyai, Cluj-Napoca

## Features

- **Login / logout**: each cyclist logs in with a username and password. The server returns a JWT, which the app keeps in local storage, so the next time the app opens it goes straight to the rides. Logout is in the top right corner.
- **My rides**: every ride belongs to a user. The list shows only your own rides, loaded page by page as you scroll (infinite scrolling). Pull down to refresh.
- **Search & filter**: search rides by title or route, and filter by type (All, MTB, Road, Commuter).
- **Create / edit rides**: the + button creates a ride, tapping a ride opens it for editing.
- **Works offline**: rides fetched from the server are saved on the phone. If the phone is offline or the server can't be reached, new rides and edits are saved on the phone, marked "Not synced", and a banner shows how many changes were not sent yet. When the phone is back online they are sent automatically.
- **Network status**: a badge in the header shows Online / Offline.
- **Live updates**: when one of your rides is created or changed (for example from another phone logged in as you), the server notifies only your phones over a secured web socket and the list updates without refreshing.

Demo accounts (created automatically when the server starts): `bogdan` / `bogdan123` and `ana` / `ana123`. Each has 24 rides.

## Rubric Mapping

### Iteration 1

| # | Requirement | Implementation |
|---|---|---|
| 1 | Define features in README | This document |
| 2 | Master-Detail UI | `RideListScreen` (master list) and `RideDetailScreen` (detail) using React Navigation Native Stack |
| 3 | REST service to fetch data | `/api/rides` endpoints, called with `fetch()` in `services/api.ts` |
| 4 | WebSocket notifications | Socket.io pushes `RIDE_CREATED` / `RIDE_UPDATED` events; the list listens and updates live |

### Iteration 2

| # | Requirement | Implementation |
|---|---|---|
| 1 | Network status | `NetworkContext.tsx` uses `@react-native-community/netinfo`; `NetworkBadge` in the header shows Online / Offline |
| 2 | Authentication | `POST /api/auth/login` returns a JWT. `AuthContext.tsx` stores it in AsyncStorage; at startup a saved token skips the login screen (`App.tsx`); Logout button clears it |
| 3 | Resources linked to the user | `rides.user_id` column. REST routes use the `requireAuth` middleware (Bearer token) and only query `WHERE user_id = <logged in user>`. Sockets send the token in the handshake (`io.use` checks it), each socket joins the room `user:<id>`, and events go only to that room |
| 4 | Online / offline behaviour | `saveRide` in `RidesContext.tsx`: online it calls REST first; offline or when REST fails it saves the change in AsyncStorage (`@pending_<user>`). Unsent rides get a "Not synced" tag and a banner counts them. Fetched rides are cached in `@rides_cache_<user>` and shown when the server can't be reached |
| 5 | Auto sync when online | `syncPending` runs when NetInfo reports the phone is online again, when the socket reconnects, at login and on pull-to-refresh |
| 6 | Pagination | `GET /api/rides?page=&limit=` returns `{ items, hasMore }`; `FlatList` `onEndReached` loads the next page |
| 7 | Search & filter | `GET /api/rides?q=&mode=` (title/route search, mode filter); offline the same filter runs on the cached rides |

### REST API

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | none | `{ username, password }` → `{ token, username }` |
| GET | `/api/rides?page=1&limit=8&q=&mode=` | Bearer | One page of your rides |
| GET | `/api/rides/:id` | Bearer | One of your rides |
| POST | `/api/rides` | Bearer | Create a ride |
| PUT | `/api/rides/:id` | Bearer | Update one of your rides |
| GET | `/api/health` | none | Server status |

### WebSocket events

| Event | Direction | Payload | When |
|---|---|---|---|
| `RIDE_CREATED` | server → the owner's sockets | the new `Ride` | One of your rides was created |
| `RIDE_UPDATED` | server → the owner's sockets | the updated `Ride` | One of your rides was changed |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React Native (Expo SDK 58) |
| Navigation | React Navigation Native Stack 7.x |
| Backend | Node.js + Express |
| Real-time | Socket.io 4.x (JWT in the handshake) |
| Database | PostgreSQL |
| Auth | JSON Web Tokens (`jsonwebtoken`) |
| Local storage | AsyncStorage |
| Network status | @react-native-community/netinfo |
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
    ├── config.ts
    ├── types.ts
    ├── services/
    │   └── api.ts
    ├── context/
    │   ├── AuthContext.tsx
    │   ├── NetworkContext.tsx
    │   └── RidesContext.tsx
    └── screens/
        ├── LoginScreen.tsx
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
PostgreSQL must be running with a database named `PDM` (user `postgres`, password `password`, or set `PGUSER` / `PGPASSWORD`). The server creates the `users` and `rides` tables and the demo accounts on first start.

### 2. Start the Frontend
```bash
cd client
npm install
npx expo start
```

Scan the QR code with Expo Go.

**Note:** The app finds the server automatically: it uses the IP of the computer running Expo (from the `exp://` URL), port 8080. If that ever fails, change `FALLBACK_HOST` in `client/config.ts` to your Wi-Fi IPv4 address, and allow port 8080 through Windows Firewall so real phones can connect.

### Trying the offline mode
1. Log in and scroll the list once (the rides are now saved on the phone).
2. Turn on airplane mode (or stop the server). The badge shows **Offline** (with the server stopped the list says "Server unreachable").
3. Create or edit a ride: it gets a **Not synced** tag and the banner counts it.
4. Turn airplane mode off (or start the server again): the changes are sent automatically and the tags disappear.
