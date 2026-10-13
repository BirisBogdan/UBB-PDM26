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
    route: "Manastur → Piata Unirii",
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
    route: "Grigorescu → Floresti → Gilau",
    distance_km: 34.0,
    riders: 5,
    start_time: "2026-10-10T09:00:00Z",
    status: "in_progress",
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

app.get("/api/rides", (_req: Request, res: Response) => {
  console.log("[REST] GET /api/rides");
  res.json(MOCK_RIDES);
});

app.get("/api/rides/:id", (req: Request, res: Response) => {
  const ride = MOCK_RIDES.find((r) => r.id === Number(req.params.id));
  if (!ride) {
    res.status(404).json({ error: "Ride not found" });
    return;
  }
  res.json(ride);
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// WebSocket — handles enrollment
io.on("connection", (socket) => {
  console.log("[WS] Client connected:", socket.id);

  // Client sends ENROLL with a ride id, server confirms
  socket.on("ENROLL", (data: { rideId: number }) => {
    console.log(`[WS] Client ${socket.id} enrolled in ride ${data.rideId}`);
    socket.emit("ENROLL_CONFIRMED", {
      rideId: data.rideId,
      message: "You have been enrolled in this ride!",
    });
  });

  socket.on("disconnect", () => {
    console.log("[WS] Client disconnected:", socket.id);
  });
});

// Start server
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`\nServer running on http://0.0.0.0:${PORT}`);
  console.log(`  REST API:  http://localhost:${PORT}/api/rides`);
  console.log(`  WebSocket: ws://localhost:${PORT}\n`);
});
