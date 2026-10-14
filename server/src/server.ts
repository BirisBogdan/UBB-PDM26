// server.ts — Express REST API + Socket.io WebSocket server

import express, { Request, Response } from "express";
import http from "http";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";
import fs from "fs";
import path from "path";

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

// ── Enrollment persistence ──────────────────────────────────────────
// Stores enrolled ride IDs in a JSON file so they survive server restarts.

const DATA_DIR = path.join(__dirname, "..", "data");
const ENROLLMENTS_FILE = path.join(DATA_DIR, "enrollments.json");

function loadEnrollments(): number[] {
  try {
    if (!fs.existsSync(ENROLLMENTS_FILE)) return [];
    const raw = fs.readFileSync(ENROLLMENTS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEnrollments(enrollments: number[]): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(ENROLLMENTS_FILE, JSON.stringify(enrollments, null, 2));
}

// In-memory cache, loaded from disk on startup
let enrolledRideIds: number[] = loadEnrollments();

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

// ── REST endpoints ──────────────────────────────────────────────────

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

// ── Enrollment REST endpoints ───────────────────────────────────────

// Get all enrolled ride IDs
app.get("/api/enrollments", (_req: Request, res: Response) => {
  console.log("[REST] GET /api/enrollments");
  res.json(enrolledRideIds);
});

// Check if enrolled in a specific ride
app.get("/api/enrollments/:rideId", (req: Request, res: Response) => {
  const rideId = Number(req.params.rideId);
  const isEnrolled = enrolledRideIds.includes(rideId);
  console.log(`[REST] GET /api/enrollments/${rideId} → ${isEnrolled}`);
  res.json({ rideId, enrolled: isEnrolled });
});

// Enroll in a ride
app.post("/api/enrollments", (req: Request, res: Response) => {
  const { rideId } = req.body as { rideId: number };
  if (!rideId) {
    res.status(400).json({ error: "rideId is required" });
    return;
  }
  if (!enrolledRideIds.includes(rideId)) {
    enrolledRideIds.push(rideId);
    saveEnrollments(enrolledRideIds);
    console.log(`[REST] POST /api/enrollments — enrolled in ride ${rideId}`);
  }
  res.json({ rideId, enrolled: true });
});

// Unenroll from a ride
app.delete("/api/enrollments/:rideId", (req: Request, res: Response) => {
  const rideId = Number(req.params.rideId);
  enrolledRideIds = enrolledRideIds.filter((id) => id !== rideId);
  saveEnrollments(enrolledRideIds);
  console.log(`[REST] DELETE /api/enrollments/${rideId} — unenrolled`);
  res.json({ rideId, enrolled: false });
});

// ── WebSocket — handles enrollment ──────────────────────────────────
io.on("connection", (socket) => {
  console.log("[WS] Client connected:", socket.id);

  // Client sends ENROLL with a ride id, server persists and confirms
  socket.on("ENROLL", (data: { rideId: number }) => {
    if (!enrolledRideIds.includes(data.rideId)) {
      enrolledRideIds.push(data.rideId);
      saveEnrollments(enrolledRideIds);
    }
    console.log(`[WS] Client ${socket.id} enrolled in ride ${data.rideId}`);
    socket.emit("ENROLL_CONFIRMED", {
      rideId: data.rideId,
      message: "You have been enrolled in this ride!",
    });
  });

  // Client sends UNENROLL with a ride id, server persists and confirms
  socket.on("UNENROLL", (data: { rideId: number }) => {
    enrolledRideIds = enrolledRideIds.filter((id) => id !== data.rideId);
    saveEnrollments(enrolledRideIds);
    console.log(`[WS] Client ${socket.id} unenrolled from ride ${data.rideId}`);
    socket.emit("UNENROLL_CONFIRMED", {
      rideId: data.rideId,
      message: "You have been unenrolled from this ride.",
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
  console.log(`  Enrollments: http://localhost:${PORT}/api/enrollments`);
  console.log(`  WebSocket: ws://localhost:${PORT}\n`);
});
