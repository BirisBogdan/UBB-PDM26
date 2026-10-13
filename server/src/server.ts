// server.ts — Express REST API + Socket.io WebSocket server

import express, { Request, Response } from "express";
import http from "http";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";

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

interface HazardAlert {
  id: number;
  type: "pothole" | "dog" | "weather" | "obstacle" | "traffic";
  message: string;
  location: string;
  severity: "low" | "medium" | "high";
  reported_at: string;
}

// Mock data
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
    title: "Somesul Mic Riverside Sprint",
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
    message: "Heavy traffic near Piata Mihai Viteazul — use side streets",
    location: "Piata Mihai Viteazul",
    severity: "low",
  },
];

// Server setup
const PORT = Number(process.env.PORT) || 8080;

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// REST endpoints

// GET /api/rides — returns all rides
app.get("/api/rides", (_req: Request, res: Response) => {
  console.log("[REST] GET /api/rides — returning %d rides", MOCK_RIDES.length);
  res.json(MOCK_RIDES);
});

// GET /api/rides/:id — returns a single ride
app.get("/api/rides/:id", (req: Request, res: Response) => {
  const ride = MOCK_RIDES.find((r) => r.id === Number(req.params.id));
  if (!ride) {
    res.status(404).json({ error: "Ride not found" });
    return;
  }
  res.json(ride);
});

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// WebSocket — emits hazard alerts every 15s to connected clients

let hazardIdCounter = 1;

io.on("connection", (socket) => {
  console.log("[WS] Client connected:", socket.id);

  const intervalId = setInterval(() => {
    const randomHazard =
      HAZARD_POOL[Math.floor(Math.random() * HAZARD_POOL.length)];

    const alert: HazardAlert = {
      ...randomHazard,
      id: hazardIdCounter++,
      reported_at: new Date().toISOString(),
    };

    console.log(`[WS] Sending alert to ${socket.id}: "${alert.message}"`);
    socket.emit("NEW_HAZARD_ALERT", alert);
  }, 15_000);

  socket.on("disconnect", () => {
    console.log("[WS] Client disconnected:", socket.id);
    clearInterval(intervalId);
  });
});

// Start server
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`\nServer running on http://0.0.0.0:${PORT}`);
  console.log(`  REST API:  http://localhost:${PORT}/api/rides`);
  console.log(`  WebSocket: ws://localhost:${PORT}`);
  console.log(`  Health:    http://localhost:${PORT}/api/health\n`);
});
