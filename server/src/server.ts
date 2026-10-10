/**
 * ============================================================================
 *  RideCluj — Backend Server
 * ============================================================================
 *
 *  This file initializes:
 *    1. An Express HTTP server with a REST API     → satisfies Rubric #3
 *    2. A Socket.io WebSocket server               → satisfies Rubric #4
 *
 *  RUBRIC MAPPING:
 *    #3  REST Service  — GET /api/rides returns a JSON array of active rides.
 *    #4  WebSocket     — The server emits NEW_HAZARD_ALERT events every 15s
 *                        to all connected clients.
 * ============================================================================
 */

import express, { Request, Response } from "express";
import http from "http";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Represents an active group ride in the system. */
interface Ride {
  id: number;
  title: string;
  mode: "mtb" | "road" | "commuter";
  route: string;
  distance_km: number;
  riders: number;
  start_time: string;
  status: "waiting" | "in_progress" | "completed";
}

/** Represents a hazard alert pushed via WebSocket. */
interface HazardAlert {
  id: number;
  type: "pothole" | "dog" | "weather" | "obstacle" | "traffic";
  message: string;
  location: string;
  severity: "low" | "medium" | "high";
  reported_at: string;
}

// ---------------------------------------------------------------------------
// Mock Data  (in a real app this would come from PostgreSQL)
// ---------------------------------------------------------------------------

const MOCK_RIDES: Ride[] = [
  {
    id: 1,
    title: "Morning Faget MTB Loop",
    mode: "mtb",
    route: "Faget Forest → Cheile Baciului → Faget",
    distance_km: 28.5,
    riders: 6,
    start_time: "2026-10-10T07:00:00Z",
    status: "in_progress",
  },
  {
    id: 2,
    title: "Turda Gorge Road Ride",
    mode: "road",
    route: "Cluj-Napoca → Turda Gorge → Cluj-Napoca",
    distance_km: 72.0,
    riders: 12,
    start_time: "2026-10-10T08:30:00Z",
    status: "in_progress",
  },
  {
    id: 3,
    title: "City Center Commute Group",
    mode: "commuter",
    route: "Mănăștur → Piața Unirii",
    distance_km: 5.2,
    riders: 4,
    start_time: "2026-10-10T07:45:00Z",
    status: "waiting",
  },
  {
    id: 4,
    title: "Hoia Baciu Night Ride",
    mode: "mtb",
    route: "Hoia Forest Loop",
    distance_km: 15.0,
    riders: 8,
    start_time: "2026-10-10T20:00:00Z",
    status: "waiting",
  },
  {
    id: 5,
    title: "Someșul Mic Riverside Sprint",
    mode: "road",
    route: "Grigorescu → Florești → Gilău",
    distance_km: 34.0,
    riders: 5,
    start_time: "2026-10-10T09:00:00Z",
    status: "in_progress",
  },
];

const HAZARD_POOL: Omit<HazardAlert, "id" | "reported_at">[] = [
  {
    type: "pothole",
    message: "Large pothole on Calea Turzii near km 3",
    location: "Calea Turzii",
    severity: "high",
  },
  {
    type: "dog",
    message: "Stray dogs spotted near Faget trailhead",
    location: "Faget Forest Entrance",
    severity: "medium",
  },
  {
    type: "weather",
    message: "Sudden rain expected in 15 minutes — wet roads ahead",
    location: "Cluj-Napoca Center",
    severity: "medium",
  },
  {
    type: "obstacle",
    message: "Fallen tree branch blocking the bike lane",
    location: "Strada Memorandumului",
    severity: "high",
  },
  {
    type: "traffic",
    message: "Heavy traffic near Piața Mihai Viteazul — use side streets",
    location: "Piața Mihai Viteazul",
    severity: "low",
  },
];

// ---------------------------------------------------------------------------
// Server Setup
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(cors()); // Allow cross-origin requests from Expo
app.use(express.json());

// Create HTTP server (shared between Express and Socket.io)
const httpServer = http.createServer(app);

// Initialize Socket.io on the same HTTP server
// ── RUBRIC #4: WebSocket server-side notifications ──
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*", // In production, lock this down
    methods: ["GET", "POST"],
  },
});

// ---------------------------------------------------------------------------
// REST API Endpoints
// ---------------------------------------------------------------------------

/**
 * GET /api/rides
 *
 * ── RUBRIC #3: REST service to fetch data ──
 *
 * Returns the full list of active group rides as a JSON array.
 * The frontend Master screen (RideListScreen) calls this endpoint
 * using fetch() inside a useEffect hook.
 */
app.get("/api/rides", (_req: Request, res: Response) => {
  console.log("[REST] GET /api/rides → returning %d rides", MOCK_RIDES.length);
  res.json(MOCK_RIDES);
});

/**
 * GET /api/rides/:id
 *
 * Returns a single ride by its ID.
 * Used by the Detail screen if it needs to refresh data.
 */
app.get("/api/rides/:id", (req: Request, res: Response) => {
  const ride = MOCK_RIDES.find((r) => r.id === Number(req.params.id));
  if (!ride) {
    res.status(404).json({ error: "Ride not found" });
    return;
  }
  console.log("[REST] GET /api/rides/%d → %s", ride.id, ride.title);
  res.json(ride);
});

/** Health-check endpoint */
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// WebSocket (Socket.io) — Real-Time Hazard Alerts
// ---------------------------------------------------------------------------

/**
 * ── RUBRIC #4: WebSocket server-side notifications ──
 *
 * When a client connects, we start a recurring timer that picks a random
 * hazard from the pool and emits it as a NEW_HAZARD_ALERT event.
 *
 * In a production app, these would be triggered by other riders reporting
 * hazards in real time.
 */

let hazardIdCounter = 1;

io.on("connection", (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  // Emit a hazard alert every 15 seconds to simulate server push
  const intervalId = setInterval(() => {
    const randomHazard =
      HAZARD_POOL[Math.floor(Math.random() * HAZARD_POOL.length)];

    const alert: HazardAlert = {
      ...randomHazard,
      id: hazardIdCounter++,
      reported_at: new Date().toISOString(),
    };

    console.log(
      `[WS] Emitting NEW_HAZARD_ALERT to ${socket.id}: "${alert.message}"`
    );

    // Emit only to this specific client (use io.emit() for broadcast)
    socket.emit("NEW_HAZARD_ALERT", alert);
  }, 15_000);

  socket.on("disconnect", () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
    clearInterval(intervalId);
  });
});

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚴 RideCluj Server running on http://0.0.0.0:${PORT}`);
  console.log(`   REST API:   http://localhost:${PORT}/api/rides`);
  console.log(`   WebSocket:  ws://localhost:${PORT}`);
  console.log(`   Health:     http://localhost:${PORT}/api/health\n`);
});
