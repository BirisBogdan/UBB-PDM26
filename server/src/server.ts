// server.ts — Express REST API + Socket.io WebSocket server

import express, { Request, Response } from "express";
import http from "http";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";
import { Pool } from "pg";

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
// Enrolled ride IDs are stored in PostgreSQL so they survive app and server restarts.

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || "PDM",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "password",
});

async function initDatabase(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS enrollments (
      ride_id INTEGER PRIMARY KEY,
      enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getEnrollments(): Promise<number[]> {
  const result = await pool.query<{ ride_id: number }>(
    "SELECT ride_id FROM enrollments ORDER BY enrolled_at"
  );
  return result.rows.map((row) => row.ride_id);
}

async function isEnrolled(rideId: number): Promise<boolean> {
  const result = await pool.query("SELECT 1 FROM enrollments WHERE ride_id = $1", [rideId]);
  return (result.rowCount ?? 0) > 0;
}

async function enroll(rideId: number): Promise<void> {
  await pool.query(
    "INSERT INTO enrollments (ride_id) VALUES ($1) ON CONFLICT (ride_id) DO NOTHING",
    [rideId]
  );
}

async function unenroll(rideId: number): Promise<void> {
  await pool.query("DELETE FROM enrollments WHERE ride_id = $1", [rideId]);
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
app.get("/api/enrollments", async (_req: Request, res: Response) => {
  console.log("[REST] GET /api/enrollments");
  try {
    res.json(await getEnrollments());
  } catch (err) {
    console.error("[DB] Failed to read enrollments:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Check if enrolled in a specific ride
app.get("/api/enrollments/:rideId", async (req: Request, res: Response) => {
  const rideId = Number(req.params.rideId);
  try {
    const enrolled = await isEnrolled(rideId);
    console.log(`[REST] GET /api/enrollments/${rideId} → ${enrolled}`);
    res.json({ rideId, enrolled });
  } catch (err) {
    console.error("[DB] Failed to read enrollment:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Enroll in a ride
app.post("/api/enrollments", async (req: Request, res: Response) => {
  const { rideId } = req.body as { rideId: number };
  if (!rideId) {
    res.status(400).json({ error: "rideId is required" });
    return;
  }
  try {
    await enroll(rideId);
    console.log(`[REST] POST /api/enrollments — enrolled in ride ${rideId}`);
    res.json({ rideId, enrolled: true });
  } catch (err) {
    console.error("[DB] Failed to enroll:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Unenroll from a ride
app.delete("/api/enrollments/:rideId", async (req: Request, res: Response) => {
  const rideId = Number(req.params.rideId);
  try {
    await unenroll(rideId);
    console.log(`[REST] DELETE /api/enrollments/${rideId} — unenrolled`);
    res.json({ rideId, enrolled: false });
  } catch (err) {
    console.error("[DB] Failed to unenroll:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ── WebSocket — handles enrollment ──────────────────────────────────
io.on("connection", (socket) => {
  console.log("[WS] Client connected:", socket.id);

  // Client sends ENROLL with a ride id, server persists and confirms
  socket.on("ENROLL", async (data: { rideId: number }) => {
    try {
      await enroll(data.rideId);
    } catch (err) {
      console.error("[DB] Failed to enroll:", err);
      return;
    }
    console.log(`[WS] Client ${socket.id} enrolled in ride ${data.rideId}`);
    socket.emit("ENROLL_CONFIRMED", {
      rideId: data.rideId,
      message: "You have been enrolled in this ride!",
    });
  });

  // Client sends UNENROLL with a ride id, server persists and confirms
  socket.on("UNENROLL", async (data: { rideId: number }) => {
    try {
      await unenroll(data.rideId);
    } catch (err) {
      console.error("[DB] Failed to unenroll:", err);
      return;
    }
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
initDatabase()
  .then(() => {
    console.log("[DB] Connected to PostgreSQL");
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`\nServer running on http://0.0.0.0:${PORT}`);
      console.log(`  REST API:  http://localhost:${PORT}/api/rides`);
      console.log(`  Enrollments: http://localhost:${PORT}/api/enrollments`);
      console.log(`  WebSocket: ws://localhost:${PORT}\n`);
    });
  })
  .catch((err) => {
    console.error("[DB] Could not connect to PostgreSQL:", err);
    process.exit(1);
  });
